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
  privacyPolicy: { type: Boolean, default: true },
  termsConditions: { type: Boolean, default: true },
  agreement: { type: Boolean, default: true }
});


// Export the model correctly
module.exports = mongoose.model('User', userSchema);
