// models/publicPetRoutes.js
const express = require('express');
const router = express.Router();
const petController = require('../controllers/petController');

// This should match the request you are making on the frontend
router.get('/public/:petId', petController.getPublicPetProfile);

module.exports = router;
