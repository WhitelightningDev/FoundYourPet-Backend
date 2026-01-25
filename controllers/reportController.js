const { validationResult } = require("express-validator");
const crypto = require("crypto");
const streamifier = require("streamifier");
const cloudinary = require("cloudinary").v2;

const Report = require("../models/Report");
const ReportComment = require("../models/ReportComment");
const ReportFlag = require("../models/ReportFlag");
const ReportReaction = require("../models/ReportReaction");
const NotificationToken = require("../models/NotificationToken");
const { canSendFcm, sendMulticast } = require("../services/fcm");
const WebPushSubscription = require("../models/WebPushSubscription");
const { canSendWebPush, sendNotification } = require("../services/webPush");

const errorHandler = (res, error, message = "Server error", statusCode = 500) => {
  console.error(error.message || error);
  return res.status(statusCode).json({ message, error: error.message });
};

const ensureCloudinaryConfigured = () => {
  const cfg = cloudinary.config();
  const cloudName = cfg?.cloud_name || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = cfg?.api_key || process.env.CLOUDINARY_API_KEY;
  const apiSecret = cfg?.api_secret || process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    const err = new Error(
      "Image upload not configured (missing CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET)"
    );
    err.code = "CLOUDINARY_NOT_CONFIGURED";
    err.statusCode = 503;
    throw err;
  }
};

const uploadImageToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = streamifier.createReadStream(fileBuffer);
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "pet_reports" },
      (error, result) => {
        if (error) reject(error);
        else resolve({ url: result.secure_url, publicId: result.public_id || null });
      }
    );
    stream.pipe(uploadStream);
  });
};

const normalizePagination = (value, { fallback, min, max }) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const ipHashFromReq = (req) => {
  const ip = (req.headers["x-forwarded-for"] || req.ip || "").toString();
  const ua = (req.headers["user-agent"] || "").toString();
  return crypto.createHash("sha256").update(`${ip}|${ua}`).digest("hex");
};

const getClientId = (req) => {
  const fromBody = req.body?.clientId;
  const fromHeader = req.headers["x-client-id"];
  const raw = (fromBody || fromHeader || "").toString().trim();
  if (raw) return raw;
  return ipHashFromReq(req);
};

const serializeReportForPublic = (reportDoc) => {
  const report = reportDoc?.toObject ? reportDoc.toObject() : reportDoc;
  if (!report) return null;
  const lastInitial = (report.lastName || "").toString().trim().slice(0, 1);
  const postedBy = [report.firstName, lastInitial ? `${lastInitial}.` : null].filter(Boolean).join(" ").trim();
  return {
    id: report._id,
    petName: report.petName || "",
    petType: report.petType || "dog",
    firstName: report.firstName,
    postedBy: postedBy || report.firstName,
    petStatus: report.petStatus,
    location: report.location,
    description: report.description || "",
    photoUrl: report.photoUrl,
    createdAt: report.createdAt,
    reactions: report.reactions || { like: 0, heart: 0, help: 0, seen: 0, helped: 0 },
    commentsCount: report.commentsCount || 0,
    flagsCount: report.flagsCount || 0,
  };
};

exports.createPublicPetReport = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });

    const {
      petName = "",
      petType = "dog",
      firstName,
      lastName,
      phoneNumber,
      petStatus,
      location,
      description = "",
    } = req.body;

    const normalizedPetType = String(petType || "dog").trim().toLowerCase() === "cat" ? "cat" : "dog";
    const normalizedPetName = String(petName || "").trim().slice(0, 80);

    let uploaded = { url: null, publicId: null };
    if (req.file?.buffer) {
      ensureCloudinaryConfigured();
      uploaded = await uploadImageToCloudinary(req.file.buffer);
    }

    const report = await Report.create({
      petName: normalizedPetName,
      petType: normalizedPetType,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      phoneNumber: String(phoneNumber).trim(),
      petStatus: String(petStatus).trim().toLowerCase(),
      location: String(location).trim(),
      description: String(description || "").trim(),
      photoUrl: uploaded.url,
      photoPublicId: uploaded.publicId,
    });

    // Fire-and-forget push notifications
    (async () => {
      const title = `New ${report.petStatus === "found" ? "found" : "lost"} pet report`;
      const body = report.location ? `Location: ${report.location}` : "Open the app to view details.";

      if (!canSendFcm()) return;
      const tokens = await NotificationToken.find({ isActive: true })
        .sort({ updatedAt: -1 })
        .limit(5000)
        .select("token")
        .lean();

      const tokenList = tokens.map((t) => t.token).filter(Boolean);
      if (!tokenList.length) return;

      const batchSize = 500;
      for (let i = 0; i < tokenList.length; i += batchSize) {
        const batch = tokenList.slice(i, i + batchSize);
        const result = await sendMulticast({
          tokens: batch,
          notification: { title, body },
          data: { url: "/reports", reportId: String(report._id) },
        });

        if (!result.ok) return;

        // Deactivate invalid tokens
        const invalid = [];
        (result.responses || []).forEach((r, idx) => {
          if (r.success) return;
          const code = r.error?.code || "";
          if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
            invalid.push(batch[idx]);
          }
        });

        if (invalid.length) {
          await NotificationToken.updateMany({ token: { $in: invalid } }, { $set: { isActive: false } });
        }
      }
    })().catch((err) => console.warn("[FCM] send failed:", err.message || err));

    (async () => {
      if (!canSendWebPush()) return;
      const subs = await WebPushSubscription.find({ isActive: true })
        .sort({ updatedAt: -1 })
        .limit(5000)
        .select("endpoint expirationTime keys")
        .lean();

      if (!subs.length) return;

      const payload = JSON.stringify({
        title: `New ${report.petStatus === "found" ? "found" : "lost"} pet report`,
        body: report.location ? `Location: ${report.location}` : "Open the app to view details.",
        url: "/reports",
        reportId: String(report._id),
      });

      for (const sub of subs) {
        const result = await sendNotification(
          {
            endpoint: sub.endpoint,
            expirationTime: sub.expirationTime ?? null,
            keys: sub.keys,
          },
          payload
        );

        if (!result.ok && (result.statusCode === 404 || result.statusCode === 410)) {
          await WebPushSubscription.updateOne({ endpoint: sub.endpoint }, { $set: { isActive: false } });
        }
      }
    })().catch((err) => console.warn("[WebPush] send failed:", err.message || err));

    return res.status(201).json({ report: serializeReportForPublic(report) });
  } catch (err) {
    if (err?.code === "CLOUDINARY_NOT_CONFIGURED") {
      return res.status(err.statusCode || 503).json({ message: err.message });
    }
    return errorHandler(res, err);
  }
};

exports.getPublicReport = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });

    const report = await Report.findOne({ _id: req.params.reportId, isHidden: { $ne: true } });
    if (!report) return res.status(404).json({ message: "Report not found" });

    return res.json({ report: serializeReportForPublic(report) });
  } catch (err) {
    return errorHandler(res, err, "Failed to load report");
  }
};

exports.listAdminReports = async (req, res) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

    const page = normalizePagination(req.query.page, { fallback: 1, min: 1, max: 100000 });
    const limit = normalizePagination(req.query.limit, { fallback: 12, min: 1, max: 50 });
    const skip = (page - 1) * limit;

    const statusFilter = (req.query.status || "").toString().trim().toLowerCase();
    const query = {};
    if (statusFilter === "lost" || statusFilter === "found") query.petStatus = statusFilter;
    if (req.query.hidden === "true") query.isHidden = true;
    if (req.query.hidden === "false") query.isHidden = false;

    const docs = await Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map((r) => ({
      id: r._id,
      petName: r.petName || "",
      petType: r.petType || "dog",
      firstName: r.firstName,
      lastName: r.lastName,
      phoneNumber: r.phoneNumber,
      petStatus: r.petStatus,
      location: r.location,
      description: r.description || "",
      photoUrl: r.photoUrl,
      createdAt: r.createdAt,
      reactions: r.reactions || { like: 0, heart: 0, help: 0, seen: 0, helped: 0 },
      commentsCount: r.commentsCount || 0,
      flagsCount: r.flagsCount || 0,
      isHidden: Boolean(r.isHidden),
    }));

    return res.json({ items, nextPage: hasMore ? page + 1 : null });
  } catch (err) {
    return errorHandler(res, err);
  }
};

exports.deleteReportAdmin = async (req, res) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
    const { reportId } = req.params;

    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    await Promise.all([
      ReportComment.deleteMany({ reportId: report._id }),
      ReportReaction.deleteMany({ reportId: report._id }),
      ReportFlag.deleteMany({ reportId: report._id }),
    ]);

    const publicId = report.photoPublicId;
    await Report.deleteOne({ _id: report._id });

    if (publicId) {
      cloudinary.uploader.destroy(publicId).catch(() => null);
    }

    return res.json({ ok: true });
  } catch (err) {
    return errorHandler(res, err);
  }
};

exports.listPublicReports = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });

    const page = normalizePagination(req.query.page, { fallback: 1, min: 1, max: 100000 });
    const limit = normalizePagination(req.query.limit, { fallback: 8, min: 1, max: 50 });
    const skip = (page - 1) * limit;

    const docs = await Report.find({ isHidden: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(serializeReportForPublic).filter(Boolean);
    return res.json({ items, nextPage: hasMore ? page + 1 : null });
  } catch (err) {
    return errorHandler(res, err);
  }
};

exports.postComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });

    const { reportId } = req.params;
    const { name = "", text } = req.body;

    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const comment = await ReportComment.create({
      reportId: report._id,
      name: String(name || "").trim(),
      text: String(text).trim(),
    });

    report.commentsCount = (report.commentsCount || 0) + 1;
    await report.save();

    return res.status(201).json({
      comment: {
        id: comment._id,
        name: comment.name,
        text: comment.text,
        createdAt: comment.createdAt,
      },
      report: serializeReportForPublic(report),
    });
  } catch (err) {
    return errorHandler(res, err);
  }
};

exports.listComments = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });

    const { reportId } = req.params;
    const page = normalizePagination(req.query.page, { fallback: 1, min: 1, max: 100000 });
    const limit = normalizePagination(req.query.limit, { fallback: 20, min: 1, max: 50 });
    const skip = (page - 1) * limit;

    const report = await Report.findById(reportId).select("_id").lean();
    if (!report) return res.status(404).json({ message: "Report not found" });

    const docs = await ReportComment.find({ reportId, isHidden: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map((c) => ({
      id: c._id,
      name: c.name || "",
      text: c.text,
      createdAt: c.createdAt,
    }));

    return res.json({ items, nextPage: hasMore ? page + 1 : null });
  } catch (err) {
    return errorHandler(res, err);
  }
};

exports.reactToReport = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });

    const { reportId } = req.params;
    const reaction = String(req.body.reaction).trim().toLowerCase();
    const clientId = getClientId(req);

    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const current = await ReportReaction.findOne({ reportId: report._id, clientId });
    const reactions = report.reactions || {};

    const clampDec = (key) => {
      const next = Math.max(0, Number(reactions[key] || 0) - 1);
      reactions[key] = next;
    };
    const inc = (key) => {
      reactions[key] = Number(reactions[key] || 0) + 1;
    };

    let myReaction = reaction;

    if (!current) {
      await ReportReaction.create({ reportId: report._id, clientId, reaction });
      inc(reaction);
    } else if (current.reaction === reaction) {
      await ReportReaction.deleteOne({ _id: current._id });
      clampDec(reaction);
      myReaction = null;
    } else {
      const prev = current.reaction;
      current.reaction = reaction;
      await current.save();
      clampDec(prev);
      inc(reaction);
    }

    report.reactions = reactions;
    await report.save();

    return res.json({ reactions: report.reactions, myReaction });
  } catch (err) {
    return errorHandler(res, err);
  }
};

exports.flagReport = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });

    const { reportId } = req.params;
    const { reason, details = "" } = req.body;

    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    await ReportFlag.create({
      reportId: report._id,
      reason: String(reason).trim(),
      details: String(details || "").trim(),
      userAgent: (req.headers["user-agent"] || "").toString(),
      ipHash: ipHashFromReq(req),
    });

    report.flagsCount = (report.flagsCount || 0) + 1;

    const threshold = Number(process.env.REPORT_AUTOHIDE_FLAGS || 0);
    if (threshold > 0 && report.flagsCount >= threshold) {
      report.isHidden = true;
    }

    await report.save();

    return res.status(201).json({ ok: true });
  } catch (err) {
    return errorHandler(res, err);
  }
};
