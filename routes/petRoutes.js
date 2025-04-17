const express = require('express');
const { check } = require('express-validator');
const petController = require('../controllers/petController');
const petAuth = require('../middleware/petAuth'); // Pet-specific authentication middleware
const router = express.Router();
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2; // Cloudinary SDK
const streamifier = require('streamifier'); // For uploading directly from a buffer

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer storage is not needed now as we're uploading directly to Cloudinary
const upload = multer();

// ----------------------------
// ROUTES
// ----------------------------

// CREATE - Add a new pet
router.post(
  '/create',
  upload.single('photo'),
  [
    check('name', 'Pet name is required').not().isEmpty(),
    check('species', 'Pet species is required').not().isEmpty(),
    check('breed', 'Pet breed is required').not().isEmpty(),
    check('age', 'Pet age is required').isNumeric(),
  ],
  petAuth,
  async (req, res) => {
    try {
      // Handle Cloudinary upload
      if (req.file) {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'pet_images' },
          (error, result) => {
            if (error) {
              return res.status(500).json({ message: 'Cloudinary upload failed', error });
            }
            // Attach the Cloudinary image URL to the pet data
            req.body.photoUrl = result.secure_url;
            petController.createPet(req, res); // Call the controller to continue the pet creation
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(uploadStream); // Upload image from buffer
      } else {
        // If no image is provided, proceed with creating the pet without a photo
        petController.createPet(req, res);
      }
    } catch (error) {
      res.status(500).json({ message: 'Error during pet creation', error });
    }
  }
);

// READ - Get all pets for the authenticated user
router.get('/', petAuth, petController.getUserPets);

// READ - Get a specific pet by ID
router.get('/:id', petAuth, petController.getPetById);

// READ - Public profile for QR scanning
router.get('/public/:petId', petController.getPublicPetProfile);

// UPDATE - Update pet details
router.put(
  '/:id',
  [
    check('name', 'Pet name is required').not().isEmpty(),
    check('species', 'Pet species is required').not().isEmpty(),
    check('breed', 'Pet breed is required').not().isEmpty(),
    check('age', 'Pet age is required').isNumeric(),
  ],
  petAuth,
  async (req, res) => {
    try {
      // Handle Cloudinary upload if new photo is provided
      if (req.file) {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'pet_images' },
          (error, result) => {
            if (error) {
              return res.status(500).json({ message: 'Cloudinary upload failed', error });
            }
            req.body.photoUrl = result.secure_url; // Update the photo URL
            petController.updatePet(req, res); // Call the controller to continue with the update
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(uploadStream); // Upload image from buffer
      } else {
        petController.updatePet(req, res); // Proceed without updating the image
      }
    } catch (error) {
      res.status(500).json({ message: 'Error during pet update', error });
    }
  }
);

// DELETE - Delete a specific pet by ID
router.delete('/:id', petAuth, petController.deletePet);

module.exports = router;
