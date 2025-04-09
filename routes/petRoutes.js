// routes/petRoutes.js
const express = require('express');
const { check } = require('express-validator');
const petController = require('../controllers/petController');
const authenticate = require('../middleware/auth'); // Import authenticate middleware directly
const router = express.Router();

// CRUD Routes for Pets
router.post('/create', [
  check('name', 'Pet name is required').not().isEmpty(),
  check('species', 'Pet species is required').not().isEmpty(),
  check('breed', 'Pet breed is required').not().isEmpty(),
  check('age', 'Pet age is required').isNumeric(),
], authenticate, petController.createPet); // Apply authenticate middleware here

router.get('/', authenticate, petController.getUserPets); // Use authenticate for route protection
router.get('/:id', authenticate, petController.getPetById); // Use authenticate for route protection
router.put('/:id', [
  check('name', 'Pet name is required').not().isEmpty(),
  check('species', 'Pet species is required').not().isEmpty(),
  check('breed', 'Pet breed is required').not().isEmpty(),
  check('age', 'Pet age is required').isNumeric(),
], authenticate, petController.updatePet); // Apply authenticate middleware here

router.delete('/:id', authenticate, petController.deletePet); // Apply authenticate middleware here

module.exports = router;
