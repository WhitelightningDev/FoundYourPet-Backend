const mongoose = require("mongoose");

const AnalyticsSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true, index: true },
    userAgent: { type: String, default: "" },
    referrer: { type: String, default: "" },

    firstPath: { type: String, default: "/" },
    lastPath: { type: String, default: "/" },
    pageviews: { type: Number, default: 0 },

    startedAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AnalyticsSession", AnalyticsSessionSchema);

