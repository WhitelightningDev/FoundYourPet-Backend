const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define user schema
const userSchema = new Schema({
  name: { type: String, required: true },
  surname: { type: String, required: true },
  contact: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  isAdmin: { type: Boolean, default: false },
  privacyPolicy: { type: Boolean, default: true },
  termsConditions: { type: Boolean, default: true },
  agreement: { type: Boolean, default: true },

  // NEW MEMBERSHIP FIELDS
  membershipActive: { type: Boolean, default: false },
  membershipStartDate: { type: Date, default: null },

  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
});

// Prevent OverwriteModelError by checking if model exists
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
