const express = require('express');
const { check } = require('express-validator');
const petController = require('../controllers/petController');
const petAuth = require('../middleware/petAuth'); // Pet-specific authentication middleware
const router = express.Router();
const multer = require('multer');

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
  petController.createPet // Call the controller directly, the controller will handle image upload
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
  petController.updatePet // Call the controller directly
);

// DELETE - Delete a specific pet by ID
router.delete('/:id', petAuth, petController.deletePet);

module.exports = router;
