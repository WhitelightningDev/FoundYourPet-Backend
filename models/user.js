const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define user schema
const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  surname: {
    type: String,
    required: true,
  },
  contact: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  privacyPolicy: {
    type: Boolean,
    default: true, // Automatically set to true
  },
  termsConditions: {
    type: Boolean,
    default: true, // Automatically set to true
  },
  agreement: {
    type: Boolean,
    default: true, // Automatically set to true (optional, you can remove this if unnecessary)
  },
});

// Export the model correctly
module.exports = mongoose.model('User', userSchema);
