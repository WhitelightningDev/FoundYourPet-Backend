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
  dateOfBirth: { type: Date },
  photoUrl: { type: String },
  color: { type: String },
  
  // Allow empty values for size, defaulting to null if not provided
  size: { 
    type: String, 
    enum: ['Small', 'Medium', 'Large'], 
    default: null,  // Allows size to be null or a valid enum value
  },
  
  weight: { type: Number },
  spayedNeutered: { type: Boolean },

  microchipNumber: { type: String },
  vaccinations: [{ type: String }],
  allergies: [{ type: String }],
  medicalConditions: [{ type: String }],
  medications: [{ type: String }],

  // Allow empty values for tagType, defaulting to null if not provided
  tagType: { 
    type: String, 
    enum: ['Standard', 'Apple AirTag', 'Samsung SmartTag'], 
    default: null,  // Allows tagType to be null or a valid enum value
  },
  
  engravingInfo: { type: String },
  tagSerial: { type: String },

  adoptionDate: { type: Date },
  trainingLevel: { type: String },
  personality: { type: String },
  dietaryPreferences: { type: String },

  vetInfo: { type: String },
  insuranceInfo: { type: String }
});

module.exports = mongoose.model("Pet", petSchema);
