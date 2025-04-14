const Pet = require('../models/Pet');
const { validationResult } = require('express-validator');
const User = require("../models/user");


// Advanced Error Handler
const errorHandler = (res, error, message = 'Server error', statusCode = 500) => {
  console.error(error.message || error);
  return res.status(statusCode).json({ msg: message, error: error.message });
};

// CREATE a new pet
exports.createPet = async (req, res) => {
  let {
    name, species, breed, age,
    gender, dateOfBirth, photoUrl, color, size, weight, spayedNeutered,
    microchipNumber, vaccinations, allergies, medicalConditions, medications,
    tagType, engravingInfo, tagSerial,
    adoptionDate, trainingLevel, personality, dietaryPreferences,
    vetInfo, insuranceInfo
  } = req.body;

  // Check and handle invalid enum values
  if (!['Small', 'Medium', 'Large'].includes(size)) {
    size = null;  // Or set a default valid value if required
  }

  if (!['Standard', 'Apple AirTag', 'Samsung SmartTag'].includes(tagType)) {
    tagType = null;  // Or set a default valid value if required
  }

  const userId = req.userId;

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const newPet = new Pet({
      name, species, breed, age,
      gender, dateOfBirth, photoUrl, color, size, weight, spayedNeutered,
      microchipNumber, vaccinations, allergies, medicalConditions, medications,
      tagType, engravingInfo, tagSerial,
      adoptionDate, trainingLevel, personality, dietaryPreferences,
      vetInfo, insuranceInfo,
      userId
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
  const userId = req.userId;

  try {
    const pet = await Pet.findOne({ _id: id, userId });
    if (!pet) {
      return res.status(404).json({ msg: 'Pet not found or not authorized' });
    }

    Object.assign(pet, req.body); // Dynamically update only provided fields
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


exports.getPublicPetProfile = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.petId);
    if (!pet) return res.status(404).json({ msg: 'Pet not found' });

    const owner = await User.findById(pet.userId).select('name surname email contact');
    if (!owner) return res.status(404).json({ msg: 'Owner not found' });

    res.json({ pet, owner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};