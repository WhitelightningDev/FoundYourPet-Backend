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
  size: { type: String, enum: ['Small', 'Medium', 'Large'] },
  weight: { type: Number },
  spayedNeutered: { type: Boolean },

  microchipNumber: { type: String },
  vaccinations: [{ type: String }],
  allergies: [{ type: String }],
  medicalConditions: [{ type: String }],
  medications: [{ type: String }],

  tagType: { type: String, enum: ['Standard', 'Apple AirTag', 'Samsung SmartTag'] },
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
