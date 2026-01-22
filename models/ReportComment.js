const mongoose = require("mongoose");

const ReportCommentSchema = new mongoose.Schema(
  {
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", required: true, index: true },
    name: { type: String, default: "", trim: true },
    text: { type: String, required: true, trim: true },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReportComment", ReportCommentSchema);

