const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    petStatus: { type: String, required: true, enum: ["lost", "found"] },
    location: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    photoUrl: { type: String, required: true },

    reactions: {
      like: { type: Number, default: 0 },
      heart: { type: Number, default: 0 },
      help: { type: Number, default: 0 },
      seen: { type: Number, default: 0 },
      helped: { type: Number, default: 0 },
    },

    commentsCount: { type: Number, default: 0 },
    flagsCount: { type: Number, default: 0 },

    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", ReportSchema);

