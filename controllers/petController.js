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
    name,
    species,
    breed,
    age,
    gender,
    color,
    size,
    spayedNeutered,
    tagType,
    vaccinations,
    allergies,
    medicalConditions,
    medications,
    engravingInfo,
    tagSerial,
    microchipNumber,
    dateOfBirth,
    personality,
    dietaryPreferences,
    vetInfo,
    insuranceInfo
  } = req.body;

  const userId = req.userId;

  // Validate enums
  if (!['Small', 'Medium', 'Large'].includes(size)) size = null;
  if (!['Standard', 'Apple AirTag', 'Samsung SmartTag'].includes(tagType)) tagType = null;
  spayedNeutered = spayedNeutered === 'true' || spayedNeutered === true;

  // Optional cleanup
  vaccinations = vaccinations || [];
  allergies = allergies || [];
  medicalConditions = medicalConditions || [];
  medications = medications || [];

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    let finalPhotoUrl = null;

    if (req.file) {
      finalPhotoUrl = `/uploads/${req.file.filename}`;
    }

    const newPet = new Pet({
      name,
      species,
      breed,
      age,
      gender,
      color,
      size,
      spayedNeutered,
      tagType,
      photoUrl: finalPhotoUrl,
      userId,
      vaccinations,
      allergies,
      medicalConditions,
      medications,
      engravingInfo,
      tagSerial,
      microchipNumber,
      dateOfBirth,
      personality,
      dietaryPreferences,
      vetInfo,
      insuranceInfo
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
    const pet = await Pet.findOne({ _id: id, userId });
    if (!pet) return res.status(404).json({ msg: 'Pet not found or not authorized to access this pet' });
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
    if (!pet) return res.status(404).json({ msg: 'Pet not found or not authorized' });

    Object.assign(pet, req.body); // Update with new values from req.body

    if (req.file) {
      pet.photoUrl = `/uploads/${req.file.filename}`;
    }

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
    const pet = await Pet.findOne({ _id: id, userId });
    if (!pet) return res.status(404).json({ msg: 'Pet not found or not authorized to delete this pet' });

    await Pet.findByIdAndDelete(pet._id);
    return res.status(200).json({ msg: 'Pet deleted successfully' });
  } catch (err) {
    return errorHandler(res, err);
  }
};

// PUBLIC pet profile (from QR code scan)
exports.getPublicPetProfile = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.petId)
      .populate('userId', 'firstName lastName email contact')
      .select(
        'name species breed age gender color photoUrl tagType engravingInfo tagSerial microchipNumber'
      );

    if (!pet) return res.status(404).json({ msg: 'Pet not found' });

    const owner = pet.userId;
    if (!owner) return res.status(404).json({ msg: 'Owner not found' });

    res.json({ pet, owner });
  } catch (err) {
    return errorHandler(res, err);
  }
};
