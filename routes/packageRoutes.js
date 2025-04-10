// packageRoutes.js
const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');

// Public Routes
router.get('/', packageController.getAllPackages);

// 👇 Add this BEFORE the `/:id` route
router.get('/type/:type', packageController.getPackageByType);

router.get('/:id', packageController.getPackageById);

// Admin Routes
router.post('/create', packageController.createPackage);

module.exports = router;
