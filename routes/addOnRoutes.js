const express = require('express');
const router = express.Router();
const addOnController = require('../controllers/addOnController');

// Get all addons
router.get('/', addOnController.getAllAddOns);

// Get addons by type using query parameter (e.g., ?type=samsung)
router.get('/filter', addOnController.getAddOnsByType);

module.exports = router;
