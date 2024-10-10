// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Route for user sign-up
router.post('/signup', userController.signUp);

module.exports = router;
