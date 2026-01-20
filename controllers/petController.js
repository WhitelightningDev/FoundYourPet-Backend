const Pet = require('../models/Pet');
const Payment = require('../models/Payment');
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

const normalizeFulfillmentForResponse = (payment) => {
  const fulfillment = payment?.fulfillment || null;
  const status = (fulfillment?.status || 'unfulfilled').toString();
  return {
    provider: fulfillment?.provider || 'pudo',
    status,
    notes: fulfillment?.notes || null,
    pudo: {
      shipmentId: fulfillment?.pudo?.shipmentId || null,
      trackingNumber: fulfillment?.pudo?.trackingNumber || null,
      status: fulfillment?.pudo?.status || null,
      labelUrl: fulfillment?.pudo?.labelUrl || null,
      lastSyncedAt: fulfillment?.pudo?.lastSyncedAt || null,
    },
    createdAt: fulfillment?.createdAt || null,
    updatedAt: fulfillment?.updatedAt || null,
    submittedAt: fulfillment?.submittedAt || null,
    shippedAt: fulfillment?.shippedAt || null,
    deliveredAt: fulfillment?.deliveredAt || null,
  };
};

const getLatestTagOrderByPetId = async ({ userId, petIds }) => {
  const ids = Array.isArray(petIds) ? petIds.filter(Boolean) : [];
  if (!ids.length) return new Map();

  const payments = await Payment.find({
    userId,
    kind: 'tag',
    status: 'successful',
    petIds: { $in: ids },
  })
    .sort({ processedAt: -1, createdAt: -1 })
    .select('_id petIds processedAt createdAt fulfillment tagType packageType amountInCents currency')
    .lean();

  const map = new Map();

  for (const payment of payments) {
    const purchasedAt = payment.processedAt || payment.createdAt || null;
    const fulfillment = normalizeFulfillmentForResponse(payment);
    const petIdList = Array.isArray(payment.petIds) ? payment.petIds : [];

    for (const petId of petIdList) {
      const key = petId?.toString?.() || String(petId);
      if (!key) continue;
      if (map.has(key)) continue; // payments already sorted newest-first

      map.set(key, {
        paymentId: payment._id,
        purchasedAt,
        amountInCents: payment.amountInCents,
        currency: payment.currency || 'ZAR',
        tagType: payment.tagType || null,
        packageType: payment.packageType || null,
        fulfillment,
      });
    }
  }

  return map;
};

// CREATE Pet
exports.createPet = async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      msg: "Pets are created after a successful subscription payment. Please start checkout to add a pet.",
    });
  }

  const {
    name,
    species,
    breed,
    age,
    gender,
    color,
    tagType,
    size,
    dateOfBirth,
    spayedNeutered,
    trainingLevel,
    weight,
    microchipNumber,
  } = req.body;
  const userId = req.userId;

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const normalizeSize = (value) => {
      const normalized = (value || '').toString().trim().toLowerCase();
      if (['small', 'medium', 'large'].includes(normalized)) return normalized;
      return null;
    };

    const normalizeBool = (value) => {
      if (typeof value === 'boolean') return value;
      const normalized = (value || '').toString().trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
      return false;
    };

    const normalizeDate = (value) => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const normalizeNumber = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const createPetInDB = async (photoUrl = null) => {
      const newPet = new Pet({
        name,
        species,
        breed,
        age,
        gender,
        color: color || null,
        size: normalizeSize(size),
        dateOfBirth: normalizeDate(dateOfBirth),
        spayedNeutered: normalizeBool(spayedNeutered),
        trainingLevel: ['Untrained', 'Basic', 'Intermediate', 'Advanced'].includes(trainingLevel)
          ? trainingLevel
          : null,
        weight: normalizeNumber(weight),
        microchipNumber: microchipNumber ? String(microchipNumber).trim() : null,
        tagType: ['Standard', 'Apple AirTag', 'Samsung SmartTag'].includes(tagType) ? tagType : null,
        photoUrl,
        userId,
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

exports.uploadPetPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "Photo file is required" });
    }
    const photoUrl = await uploadImageToCloudinary(req.file.buffer);
    return res.status(200).json({ photoUrl });
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
      size,
      dateOfBirth,
      spayedNeutered,
      trainingLevel,
      weight,
      microchipNumber,
    } = req.body;

    if (name) pet.name = name;
    if (species) pet.species = species;
    if (breed) pet.breed = breed;
    if (age) pet.age = age;
    if (gender) pet.gender = gender;
    if (color !== undefined) pet.color = color;
    if (size !== undefined) {
      const normalizedSize = (size || '').toString().trim().toLowerCase();
      pet.size = ['small', 'medium', 'large'].includes(normalizedSize) ? normalizedSize : null;
    }
    if (dateOfBirth !== undefined) {
      if (!dateOfBirth) {
        pet.dateOfBirth = null;
      } else {
        const d = new Date(dateOfBirth);
        pet.dateOfBirth = Number.isNaN(d.getTime()) ? pet.dateOfBirth : d;
      }
    }
    if (spayedNeutered !== undefined) {
      const normalized = (spayedNeutered || '').toString().trim().toLowerCase();
      if (normalized === 'true') pet.spayedNeutered = true;
      else if (normalized === 'false') pet.spayedNeutered = false;
      else if (typeof spayedNeutered === 'boolean') pet.spayedNeutered = spayedNeutered;
    }
    if (trainingLevel !== undefined) {
      pet.trainingLevel = ['Untrained', 'Basic', 'Intermediate', 'Advanced'].includes(trainingLevel)
        ? trainingLevel
        : null;
    }
    if (weight !== undefined) {
      const n = Number(weight);
      pet.weight = Number.isFinite(n) ? n : null;
    }
    if (microchipNumber !== undefined) {
      pet.microchipNumber = microchipNumber ? String(microchipNumber).trim() : null;
    }
    if (tagType && ['Standard', 'Apple AirTag', 'Samsung SmartTag'].includes(tagType)) {
      pet.tagType = tagType;
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
    const pets = await Pet.find({ userId }).lean();
    const petIds = pets.map((pet) => pet._id);
    const latestTagOrderByPetId = await getLatestTagOrderByPetId({ userId, petIds });

    const enriched = pets.map((pet) => {
      const key = pet?._id?.toString?.() || String(pet?._id);
      return {
        ...pet,
        tagOrder: latestTagOrderByPetId.get(key) || null,
      };
    });

    return res.status(200).json(enriched);
  } catch (err) {
    return errorHandler(res, err);
  }
};

// READ a specific pet by its ID
exports.getPetById = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  try {
    const pet = await Pet.findOne({ _id: id, userId }).lean();
    if (!pet) return res.status(404).json({ msg: 'Pet not found or not authorized to access this pet' });

    const latestTagOrderByPetId = await getLatestTagOrderByPetId({ userId, petIds: [pet._id] });
    const key = pet?._id?.toString?.() || String(pet?._id);
    return res.status(200).json({
      ...pet,
      tagOrder: latestTagOrderByPetId.get(key) || null,
    });
  } catch (err) {
    return errorHandler(res, err);
  }
};

// PUBLIC pet profile (for QR code scan)
exports.getPublicPetProfile = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.petId)
      .populate('userId', 'name surname email contact')
      .select('name species breed age gender color photoUrl tagType microchipNumber size');

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
    if (!req.user?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admins only' });
    }

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
