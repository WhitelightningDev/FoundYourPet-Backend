const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planKey: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'past_due', 'cancelled', 'pending'],
      default: 'pending',
      index: true,
    },
    payfastToken: { type: String, default: null, trim: true },
    payfastSubscriptionId: { type: String, default: null, trim: true },
    startDate: { type: Date, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    nextBillingDate: { type: Date, default: null },
    lastPaymentAt: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    pastDueAt: { type: Date, default: null },
    gracePeriodEndsAt: { type: Date, default: null },
    setupFeeAmountZar: { type: Number, default: null },
    setupFeePaidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ userId: 1, planKey: 1 }, { unique: true });

module.exports =
  mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
