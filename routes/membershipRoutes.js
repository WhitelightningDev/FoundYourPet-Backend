const express = require('express');
const router = express.Router();
const Membership = require('../models/Membership');

// GET all membership plans
router.get('/', async (req, res) => {
  try {
    const memberships = await Membership.find();
    res.json(memberships);
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch memberships', error: error.message });
  }
});

module.exports = router;
