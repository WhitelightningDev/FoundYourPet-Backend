const mongoose = require('mongoose');

const addOnSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Engraving", "AirTag Collar Holder"
  price: { type: Number, required: true }, // Price in Rands
  applicableTo: {
    type: [String], // e.g. ['standard', 'apple', 'samsung']
    enum: ['standard', 'apple', 'samsung'],
    required: true,
  },
  imageUrl: String, // Optional, for frontend display
});

module.exports = mongoose.model('AddOn', addOnSchema);
