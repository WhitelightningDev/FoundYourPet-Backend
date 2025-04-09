// models/Pet.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const petSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  species: {
    type: String,
    required: true,
  },
  breed: {
    type: String,
    required: true,
  },
  age: {
    type: Number,
    required: true,
  },
  userId: { // Ensure this field is defined correctly as `userId`
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Reference to the `User` model
    required: true, // This ensures userId is mandatory
  },
});

module.exports = mongoose.model("Pet", petSchema);

