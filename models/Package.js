const mongoose = require('mongoose');

const PackageSchema = new mongoose.Schema({
  name: String,
  description: String,
  basePrice: Number,
  price: Number,
  features: [String],
  type: {
    type: String,
    required: true,
    enum: ['standard', 'samsung', 'apple']  // Make sure this is included
  }
});

const Package = mongoose.model('Package', PackageSchema);
module.exports = Package;
