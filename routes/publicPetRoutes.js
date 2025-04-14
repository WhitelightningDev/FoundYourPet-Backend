const express = require('express');
const router = express.Router();
const petController = require('../controllers/petController');

router.get('/:petId', petController.getPublicPetProfile);

module.exports = router;
