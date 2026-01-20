const express = require('express');
const router = express.Router();
const addOnController = require('../controllers/addOnController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Get all addons
router.get('/', addOnController.getAllAddOns);

// Get addons by type using query parameter (e.g., ?type=samsung)
router.get('/filter', addOnController.getAddOnsByType);

router.get('/:id', addOnController.getAddOnById);

// Admin CRUD
router.post('/', auth, admin, addOnController.createAddOn);
router.put('/:id', auth, admin, addOnController.updateAddOn);
router.delete('/:id', auth, admin, addOnController.deleteAddOn);

module.exports = router;
