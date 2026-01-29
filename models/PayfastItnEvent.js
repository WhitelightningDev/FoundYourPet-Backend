const mongoose = require('mongoose');

const PayfastItnEventSchema = new mongoose.Schema(
  {
    pf_payment_id: { type: String, required: true, unique: true, trim: true },
    m_payment_id: { type: String, default: null, trim: true },
    payment_status: { type: String, default: null, trim: true },
    amount_gross: { type: Number, default: null },
    amount_fee: { type: Number, default: null },
    amount_net: { type: Number, default: null },
    item_name: { type: String, default: null, trim: true },
    name_first: { type: String, default: null, trim: true },
    name_last: { type: String, default: null, trim: true },
    email_address: { type: String, default: null, trim: true },
    token: { type: String, default: null, trim: true },
    billing_date: { type: Date, default: null },
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
    rawBody: { type: String, default: null },
    receivedAt: { type: Date, default: Date.now },
    processedOk: { type: Boolean, default: false },
    processingError: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.PayfastItnEvent || mongoose.model('PayfastItnEvent', PayfastItnEventSchema);

