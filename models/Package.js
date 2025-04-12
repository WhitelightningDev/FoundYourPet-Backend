const mongoose = require('mongoose');

const PackageSchema = new mongoose.Schema({
  name: String,
  description: String,
  basePrice: Number,
  price: Number,
  features: [String], // updated from "includes"
  type: {
    type: String,
    required: true,
    enum: ['standard', 'samsung', 'apple']
  }
});

const Package = mongoose.model('Package', PackageSchema);
module.exports = Package;
