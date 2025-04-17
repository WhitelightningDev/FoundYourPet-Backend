const Pet = require('../models/Pet');
const { validationResult } = require('express-validator');
const User = require("../models/user");
// ✅ ADD THESE IMPORTS
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

// Advanced Error Handler
const errorHandler = (res, error, message = 'Server error', statusCode = 500) => {
  console.error(error.message || error);
  return res.status(statusCode).json({ msg: message, error: error.message });
};

exports.createPet = async (req, res) => {
  let {
    name,
    species,
    breed,
    age,
    gender,
  } = req.body;

  const userId = req.userId;

  if (!['Small', 'Medium', 'Large'].includes(size)) size = null;
  if (!['Standard', 'Apple AirTag', 'Samsung SmartTag'].includes(tagType)) tagType = null;
  spayedNeutered = spayedNeutered === 'true' || spayedNeutered === true;

  vaccinations = vaccinations || [];
  allergies = allergies || [];
  medicalConditions = medicalConditions || [];
  medications = medications || [];

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const createPetInDB = async (photoUrl = null) => {
      const newPet = new Pet({
        name,
        species,
        breed,
        age,
        gender,
        spayedNeutered,
        photoUrl,
        userId,
      });

      await newPet.save();
      return res.status(201).json({ msg: "Pet added successfully", pet: newPet });
    };

    // ✅ If there's a file, upload to Cloudinary first
    if (req.file) {
      const stream = streamifier.createReadStream(req.file.buffer);
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'pet_images' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.pipe(uploadStream);
      });

      await createPetInDB(result.secure_url);
    } else {
      await createPetInDB(); // No image, proceed without photo
    }

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
// UPDATE a pet
exports.updatePet = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const pet = await Pet.findOne({ _id: id, userId });
    if (!pet) return res.status(404).json({ msg: 'Pet not found or not authorized' });

    Object.assign(pet, req.body); // Update with new values from req.body

    // Upload new image to Cloudinary if it exists
    if (req.file) {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'pet_images' },
        (error, result) => {
          if (error) {
            return res.status(500).json({ message: 'Cloudinary upload failed', error });
          }
          pet.photoUrl = result.secure_url; // Update the photo URL
          updatePetInDB(); // Continue updating the pet in the database
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(uploadStream); // Upload from buffer
    } else {
      updatePetInDB(); // Proceed if no new file is uploaded
    }

    // Function to update the pet after the image upload
    const updatePetInDB = async () => {
      await pet.save();
      return res.status(200).json({ msg: 'Pet updated successfully', pet });
    };
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
