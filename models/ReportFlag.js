const mongoose = require("mongoose");

const ReportFlagSchema = new mongoose.Schema(
  {
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", required: true, index: true },
    reason: { type: String, required: true, trim: true },
    details: { type: String, default: "", trim: true },
    userAgent: { type: String, default: "" },
    ipHash: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReportFlag", ReportFlagSchema);

