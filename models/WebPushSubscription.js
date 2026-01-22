const mongoose = require("mongoose");

const WebPushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true, unique: true, index: true },
    expirationTime: { type: Number, default: null },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },

    platform: { type: String, default: "web", enum: ["web", "ios", "android", "unknown"] },
    userAgent: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WebPushSubscription", WebPushSubscriptionSchema);

