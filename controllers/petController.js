const Pet = require('../models/Pet');
const { validationResult } = require('express-validator');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

// Error Handler
const errorHandler = (res, error, message = 'Server error', statusCode = 500) => {
  console.error(error.message || error);
  return res.status(statusCode).json({ msg: message, error: error.message });
};

// Utility function to upload to Cloudinary
const uploadImageToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = streamifier.createReadStream(fileBuffer);
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'pet_images' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.pipe(uploadStream);
  });
};

// CREATE Pet
exports.createPet = async (req, res) => {
  const { name, species, breed, age, gender, color, tagType, membershipId } = req.body;
  const userId = req.userId;

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
        color: color || null,
        tagType: ['Standard', 'Apple AirTag', 'Samsung SmartTag'].includes(tagType) ? tagType : null,
        photoUrl,
        userId,
        hasMembership: membershipId ? true : false,
        membership: membershipId || null,
        membershipStartDate: membershipId ? new Date() : null
      });

      await newPet.save();
      return res.status(201).json({ msg: "Pet added successfully", pet: newPet });
    };

    if (req.file) {
      const photoUrl = await uploadImageToCloudinary(req.file.buffer);
      await createPetInDB(photoUrl);
    } else {
      await createPetInDB();
    }

  } catch (err) {
    return errorHandler(res, err);
  }
};

// UPDATE Pet
exports.updatePet = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const pet = await Pet.findOne({ _id: id, userId });
    if (!pet) return res.status(404).json({ msg: 'Pet not found or not authorized' });

    const {
      name,
      species,
      breed,
      age,
      gender,
      color,
      tagType,
      membershipId
    } = req.body;

    if (name) pet.name = name;
    if (species) pet.species = species;
    if (breed) pet.breed = breed;
    if (age) pet.age = age;
    if (gender) pet.gender = gender;
    if (color !== undefined) pet.color = color;
    if (tagType && ['Standard', 'Apple AirTag', 'Samsung SmartTag'].includes(tagType)) {
      pet.tagType = tagType;
    }

    if (membershipId) {
      pet.membership = membershipId;
      pet.hasMembership = true;
      pet.membershipStartDate = new Date();
    }

    if (req.file) {
      const photoUrl = await uploadImageToCloudinary(req.file.buffer);
      pet.photoUrl = photoUrl;
    }

    await pet.save();
    return res.status(200).json({ msg: 'Pet updated successfully', pet });
  } catch (err) {
    return errorHandler(res, err);
  }
};

// DELETE Pet
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

// PUBLIC pet profile (for QR code scan)
exports.getPublicPetProfile = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.petId)
      .populate('userId', 'name surname email contact')
      .select('name species breed age gender color photoUrl tagType');

    if (!pet) return res.status(404).json({ msg: 'Pet not found' });

    const owner = pet.userId;
    if (!owner) return res.status(404).json({ msg: 'Owner not found' });

    res.json({ pet, owner });
  } catch (err) {
    return errorHandler(res, err);
  }
};

// Manually update membership of a pet
exports.updatePetMembership = async (req, res) => {
  const { petId, membership } = req.body;

  try {
    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ success: false, message: "Pet not found" });

    pet.membership = membership;
    pet.hasMembership = !!membership;
    pet.membershipStartDate = new Date();

    await pet.save();
    res.status(200).json({ success: true, pet });
  } catch (err) {
    return errorHandler(res, err);
  }
};
