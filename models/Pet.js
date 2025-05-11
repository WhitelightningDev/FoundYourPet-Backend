const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const petSchema = new Schema({
  name: { type: String, required: true },
  species: { type: String, required: true },
  breed: { type: String, required: true },
  age: { type: Number, required: true },
  color: {type: String, required: false},
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Other' },
  photoUrl: { type: String },
  color: { type: String },

  tagType: { 
    type: String, 
    enum: ['Standard', 'Apple AirTag', 'Samsung SmartTag'], 
    default: null,
  },

  // MEMBERSHIP TRACKING
  hasMembership: { type: Boolean, default: false },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
  membershipStartDate: { type: Date, default: null }
});

module.exports = mongoose.model("Pet", petSchema);
