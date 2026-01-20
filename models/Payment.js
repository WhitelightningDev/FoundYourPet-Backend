const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  petIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pet' }],
  kind: { type: String, enum: ['membership', 'tag'], required: true },
  amountInCents: { type: Number, required: true },
  currency: { type: String, default: 'ZAR' },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
  petDraft: {
    name: { type: String, default: null },
    species: { type: String, default: null },
    breed: { type: String, default: null },
    age: { type: Number, default: null },
    gender: { type: String, default: null },
    color: { type: String, default: null },
    size: { type: String, default: null },
    dateOfBirth: { type: Date, default: null },
    spayedNeutered: { type: Boolean, default: false },
    trainingLevel: { type: String, default: null },
    weight: { type: Number, default: null },
    microchipNumber: { type: String, default: null },
    photoUrl: { type: String, default: null },
  },
  packageType: { type: String },
  status: { type: String, enum: ['pending', 'successful', 'failed'], default: 'pending' },
  yocoChargeId: { type: String },
  yocoCheckoutId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Payment', paymentSchema);
