const express = require('express');
const { check } = require('express-validator');
const userController = require('../controllers/userController');
const router = express.Router();

// Route for user signup
router.post(
  '/signup',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('surname', 'Surname is required').not().isEmpty(),
    check('contact', 'Contact is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters long').isLength({ min: 6 }),
    // Removed checks for privacyPolicy, termsConditions, and agreement
  ],
  userController.signUp
);

// Other user routes
router.get('/users', userController.getAllUsers);
router.get('/users/:id', userController.getUserById);
router.put('/users/:id', userController.updateUser);
router.delete('/users/:id', userController.deleteUser);

module.exports = router;
