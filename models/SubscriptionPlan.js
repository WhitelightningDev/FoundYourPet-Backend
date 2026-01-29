const mongoose = require('mongoose');

const SubscriptionPlanSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    // Back-compat: amountZar is treated as recurring amount (monthly)
    amountZar: { type: Number, required: true, min: 0 },
    initialAmountZar: { type: Number, default: null, min: 0 },
    recurringAmountZar: { type: Number, default: null, min: 0 },
    currency: { type: String, default: 'ZAR', trim: true },
    interval: { type: String, enum: ['month'], default: 'month' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SubscriptionPlan ||
  mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
