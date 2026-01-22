const { validationResult } = require("express-validator");

const NotificationToken = require("../models/NotificationToken");
const { canSendFcm, sendMulticast } = require("../services/fcm");

const errorHandler = (res, error, message = "Server error", statusCode = 500) => {
  console.error(error.message || error);
  return res.status(statusCode).json({ message, error: error.message });
};

exports.registerToken = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });

    const token = String(req.body.token || "").trim();
    const platform = String(req.body.platform || "web").trim().toLowerCase();
    const userAgent = String(req.body.userAgent || req.headers["user-agent"] || "").trim();

    const allowedPlatforms = new Set(["web", "ios", "android", "unknown"]);
    const safePlatform = allowedPlatforms.has(platform) ? platform : "unknown";

    await NotificationToken.findOneAndUpdate(
      { token },
      { $set: { platform: safePlatform, userAgent, isActive: true, lastSeenAt: new Date() } },
      { upsert: true, new: true }
    );

    return res.status(201).json({ ok: true });
  } catch (err) {
    return errorHandler(res, err);
  }
};

// Admin-only helper endpoint
exports.broadcast = async (req, res) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
    if (!canSendFcm()) return res.status(400).json({ message: "FCM not configured" });

    const title = String(req.body.title || "Found Your Pet").trim();
    const body = String(req.body.body || "").trim();
    const data = req.body.data && typeof req.body.data === "object" ? req.body.data : {};

    const tokens = await NotificationToken.find({ isActive: true }).limit(500).select("token").lean();
    const tokenList = tokens.map((t) => t.token).filter(Boolean);
    const result = await sendMulticast({ tokens: tokenList, notification: { title, body }, data });

    if (!result.ok) return res.status(500).json({ message: result.error || "Failed to send" });
    return res.json({ ok: true, sent: result.sent, failed: result.failed });
  } catch (err) {
    return errorHandler(res, err);
  }
};

