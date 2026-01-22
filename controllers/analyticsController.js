const { validationResult } = require("express-validator");
const AnalyticsSession = require("../models/AnalyticsSession");

const errorHandler = (res, error, message = "Server error", statusCode = 500) => {
  console.error(error.message || error);
  return res.status(statusCode).json({ message, error: error.message });
};

const clampInt = (value, { fallback, min, max }) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

exports.track = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });

    const now = new Date();
    const sessionId = String(req.body.sessionId).trim();
    const clientId = String(req.body.clientId).trim();
    const eventType = String(req.body.eventType || "heartbeat").trim().toLowerCase();
    const path = String(req.body.path || "/").trim() || "/";
    const referrer = String(req.body.referrer || "").trim();
    const userAgent = String(req.body.userAgent || req.headers["user-agent"] || "").trim();

    const update = {
      clientId,
      userAgent,
      lastPath: path,
      lastSeenAt: now,
    };

    if (eventType === "session_start") {
      update.startedAt = now;
      update.firstPath = path;
      update.referrer = referrer;
      update.pageviews = 1;
    } else if (eventType === "pageview") {
      update.$inc = { pageviews: 1 };
    }

    const existing = await AnalyticsSession.findOne({ sessionId }).lean();
    if (!existing) {
      await AnalyticsSession.create({
        sessionId,
        clientId,
        userAgent,
        referrer,
        firstPath: path,
        lastPath: path,
        pageviews: 1,
        startedAt: now,
        lastSeenAt: now,
      });
      return res.status(201).json({ ok: true });
    }

    const updateDoc = { $set: update };
    if (update.$inc) updateDoc.$inc = update.$inc;
    await AnalyticsSession.updateOne({ sessionId }, updateDoc);
    return res.json({ ok: true });
  } catch (err) {
    return errorHandler(res, err);
  }
};

exports.summary = async (req, res) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

    const days = clampInt(req.query.days, { fallback: 7, min: 1, max: 90 });
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [sessions, uniqueClients] = await Promise.all([
      AnalyticsSession.find({ startedAt: { $gte: since } }).lean(),
      AnalyticsSession.distinct("clientId", { startedAt: { $gte: since } }),
    ]);

    const totalSessions = sessions.length;
    const uniqueVisitors = uniqueClients.length;

    const durationsSec = sessions.map((s) =>
      Math.max(0, (new Date(s.lastSeenAt).getTime() - new Date(s.startedAt).getTime()) / 1000)
    );
    const avgDurationSec =
      durationsSec.length ? durationsSec.reduce((a, b) => a + b, 0) / durationsSec.length : 0;
    const avgPageviews =
      sessions.length ? sessions.reduce((sum, s) => sum + (s.pageviews || 0), 0) / sessions.length : 0;

    const now = Date.now();
    const onlineNow = sessions.filter((s) => now - new Date(s.lastSeenAt).getTime() <= 60_000).length;

    const topPagesMap = new Map();
    for (const s of sessions) {
      const key = s.lastPath || "/";
      topPagesMap.set(key, (topPagesMap.get(key) || 0) + 1);
    }
    const topPages = Array.from(topPagesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([path, count]) => ({ path, count }));

    return res.json({
      ok: true,
      windowDays: days,
      totalSessions,
      uniqueVisitors,
      onlineNow,
      avgDurationSec,
      avgPageviews,
      topPages,
    });
  } catch (err) {
    return errorHandler(res, err);
  }
};

