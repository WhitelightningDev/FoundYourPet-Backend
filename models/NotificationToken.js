const mongoose = require("mongoose");

const NotificationTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    platform: { type: String, default: "web", enum: ["web", "ios", "android", "unknown"] },
    userAgent: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NotificationToken", NotificationTokenSchema);

