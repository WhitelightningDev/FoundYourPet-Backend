const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const petSchema = new Schema({
  name: { type: String, required: true },
  species: { type: String, required: true },
  breed: { type: String, required: true },
  age: { type: Number, required: true },
  color: { type: String },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Other' },
  photoUrl: { type: String },

  // MEMBERSHIP INFO (optional; set on checkout/activation)
  hasMembership: { type: Boolean, default: false },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
  membershipStartDate: { type: Date, default: null },

  // TAG INFO (specific to this pet)
  tagType: {
    type: String,
    enum: ['Standard', 'Apple AirTag', 'Samsung SmartTag'],
    default: null,
  },
  hasTag: { type: Boolean, default: false },
  tagPurchaseDate: { type: Date, default: null }  // optional, track when it was bought
});

module.exports = mongoose.model("Pet", petSchema);
