// models/Membership.js
const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
  name: String,
  price: Number,
  features: [String], // e.g. ["24/7 support", "Lost pet alert"]
  billingCycle: { type: String, default: "monthly" },
});

module.exports = mongoose.model('Membership', membershipSchema);
