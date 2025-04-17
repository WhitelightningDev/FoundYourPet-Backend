// models/petRoutes.js
const express = require('express');
const { check } = require('express-validator');
const petController = require('../controllers/petController');
const petAuth = require('../middleware/petAuth'); // Pet-specific authentication middleware
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

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
  petController.createPet
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
  petController.updatePet
);

// DELETE - Delete a specific pet by ID
router.delete('/:id', petAuth, petController.deletePet);

module.exports = router;
