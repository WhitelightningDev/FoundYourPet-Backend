// models/User.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
    required: true,
  },
  termsConditions: {
    type: Boolean,
    required: true,
  },
  agreement: {
    type: Boolean,
    required: true,
  },
});

module.exports = mongoose.model('User', userSchema);
