const mongoose = require('mongoose');

const PayfastCheckoutSessionSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planKey: { type: String, required: true, trim: true },
    actionUrl: { type: String, required: true, trim: true },
    fields: { type: mongoose.Schema.Types.Mixed, required: true },
    context: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

PayfastCheckoutSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.PayfastCheckoutSession ||
  mongoose.model('PayfastCheckoutSession', PayfastCheckoutSessionSchema);
