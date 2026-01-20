const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// GET all membership plans
router.get('/', membershipController.getAllMemberships);
router.get('/:id', membershipController.getMembershipById);

// Admin CRUD
router.post('/', auth, admin, membershipController.createMembership);
router.put('/:id', auth, admin, membershipController.updateMembership);
router.delete('/:id', auth, admin, membershipController.deleteMembership);

module.exports = router;
