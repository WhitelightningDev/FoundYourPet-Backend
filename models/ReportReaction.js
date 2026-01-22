const mongoose = require("mongoose");

const ReportReactionSchema = new mongoose.Schema(
  {
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", required: true, index: true },
    clientId: { type: String, required: true, index: true },
    reaction: { type: String, required: true, enum: ["like", "heart", "help", "seen", "helped"] },
  },
  { timestamps: true }
);

ReportReactionSchema.index({ reportId: 1, clientId: 1 }, { unique: true });

module.exports = mongoose.model("ReportReaction", ReportReactionSchema);

