// packageRoutes.js
const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Public Routes
router.get('/', packageController.getAllPackages);

// 👇 Add this BEFORE the `/:id` route
router.get('/type/:type', packageController.getPackageByType);

router.get('/:id', packageController.getPackageById);

// Admin Routes
router.post('/create', auth, admin, packageController.createPackage);
router.put('/:id', auth, admin, packageController.updatePackage);
router.delete('/:id', auth, admin, packageController.deletePackage);

module.exports = router;
