// models/petRoutes.js
const express = require('express');
const { check } = require('express-validator');
const petController = require('../controllers/petController');
const authenticate = require('../middleware/auth'); // Import authenticate middleware for general user auth
const petAuth = require('../middleware/petAuth'); // Import pet-specific auth middleware
const router = express.Router();
const multer = require('multer');
const storage = multer.memoryStorage(); // Or configure for disk/cloud storage
const upload = multer({ storage });


// CRUD Routes for Pets
// CREATE - Add a new pet (with petAuth to handle the userId)
// Replace the create route
router.post('/create', upload.single('photo'), [
  check('name', 'Pet name is required').not().isEmpty(),
  check('species', 'Pet species is required').not().isEmpty(),
  check('breed', 'Pet breed is required').not().isEmpty(),
  check('age', 'Pet age is required').isNumeric(),
], petAuth, petController.createPet); // Apply petAuth for userId handling

// READ - Get all pets for the authenticated user
router.get('/', petAuth, petController.getUserPets); // Use petAuth to validate userId

// READ - Get a specific pet by ID
router.get('/:id', petAuth, petController.getPetById); // Use petAuth to validate userId

// GET /api/pets/public/:petId
router.get('/public/:petId', petController.getPublicPetProfile);


// UPDATE - Update pet details
router.put('/:id', [
  check('name', 'Pet name is required').not().isEmpty(),
  check('species', 'Pet species is required').not().isEmpty(),
  check('breed', 'Pet breed is required').not().isEmpty(),
  check('age', 'Pet age is required').isNumeric(),
], petAuth, petController.updatePet); // Apply petAuth for userId handling

// DELETE - Delete a specific pet by ID
router.delete('/:id', petAuth, petController.deletePet); // Use petAuth to validate userId

module.exports = router;
