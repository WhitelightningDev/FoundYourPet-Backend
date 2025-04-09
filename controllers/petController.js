const Pet = require('../models/Pet');
const { validationResult } = require('express-validator');

// Advanced Error Handler
const errorHandler = (res, error, message = 'Server error', statusCode = 500) => {
  console.error(error.message || error);
  return res.status(statusCode).json({ msg: message, error: error.message });
};

// CREATE a new pet
exports.createPet = async (req, res) => {
  const { name, species, breed, age } = req.body;
  const userId = req.userId;  // This will come from the authenticated user

  try {
    // Validate the input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Create a new pet and associate with the user
    const newPet = new Pet({
      name,
      species,
      breed,
      age,
      userId, // Associate pet with the logged-in user
    });

    await newPet.save();
    return res.status(201).json({ msg: "Pet added successfully", pet: newPet });
  } catch (err) {
    return errorHandler(res, err);
  }
};

// READ all pets for the authenticated user
exports.getUserPets = async (req, res) => {
  const userId = req.userId;

  try {
    // Fetch pets only for the logged-in user
    const pets = await Pet.find({ userId });
    return res.status(200).json(pets);
  } catch (err) {
    return errorHandler(res, err);
  }
};

// READ a specific pet by its ID
exports.getPetById = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    // Ensure that the pet belongs to the logged-in user
    const pet = await Pet.findOne({ _id: id, userId });
    if (!pet) {
      return res.status(404).json({ msg: 'Pet not found or not authorized to access this pet' });
    }
    return res.status(200).json(pet);
  } catch (err) {
    return errorHandler(res, err);
  }
};

// UPDATE a pet
exports.updatePet = async (req, res) => {
  const { id } = req.params;
  const { name, species, breed, age } = req.body;
  const userId = req.userId;

  try {
    // Find pet by ID and ensure it belongs to the logged-in user
    const pet = await Pet.findOne({ _id: id, userId });
    if (!pet) {
      return res.status(404).json({ msg: 'Pet not found or not authorized to update this pet' });
    }

    // Update pet details
    pet.name = name || pet.name;
    pet.species = species || pet.species;
    pet.breed = breed || pet.breed;
    pet.age = age || pet.age;

    await pet.save();
    return res.status(200).json({ msg: 'Pet updated successfully', pet });
  } catch (err) {
    return errorHandler(res, err);
  }
};

// DELETE a pet
exports.deletePet = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    // Find pet by ID and ensure it belongs to the logged-in user
    const pet = await Pet.findOne({ _id: id, userId });
    if (!pet) {
      return res.status(404).json({ msg: 'Pet not found or not authorized to delete this pet' });
    }

    await pet.remove();
    return res.status(200).json({ msg: 'Pet deleted successfully' });
  } catch (err) {
    return errorHandler(res, err);
  }
};
