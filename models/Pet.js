const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const petSchema = new Schema({
  name: { type: String, required: true },
  species: { type: String, required: true },
  breed: { type: String, required: true },
  age: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // NEW FIELDS
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Other' },
  photoUrl: { type: String },
  color: { type: String },
  
  // Allow empty values for tagType, defaulting to null if not provided
  tagType: { 
    type: String, 
    enum: ['Standard', 'Apple AirTag', 'Samsung SmartTag'], 
    default: null,  // Allows tagType to be null or a valid enum value
  },

});

module.exports = mongoose.model("Pet", petSchema);
