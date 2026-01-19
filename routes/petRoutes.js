const express = require('express');
const { check } = require('express-validator');
const petController = require('../controllers/petController');
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
  petController.createPet // Call the controller directly, the controller will handle image upload
);

// READ - Get all pets for the authenticated user
router.get('/', petController.getUserPets);

// READ - Get a specific pet by ID
router.get('/:id', petController.getPetById);

// UPDATE - Update pet details
router.put(
  '/:id',
  upload.single('photo'),
  [
    check('name', 'Pet name must not be empty').optional().not().isEmpty(),
    check('species', 'Pet species must not be empty').optional().not().isEmpty(),
    check('breed', 'Pet breed must not be empty').optional().not().isEmpty(),
    check('age', 'Pet age must be a number').optional().isNumeric(),
  ],
  petController.updatePet // Call the controller directly
);

router.post('/updateMembership', petController.updatePetMembership);



// DELETE - Delete a specific pet by ID
router.delete('/:id', petController.deletePet);

module.exports = router;
