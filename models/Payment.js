const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  petIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pet' }],
  amountInCents: { type: Number, required: true },
  currency: { type: String, default: 'ZAR' },
  membership: { type: Boolean, default: false },
  packageType: { type: String },
  status: { type: String, enum: ['pending', 'successful', 'failed'], default: 'pending' },
  yocoChargeId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Payment', paymentSchema);
