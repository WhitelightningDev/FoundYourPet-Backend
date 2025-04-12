const express = require('express');
const { check } = require('express-validator');
const userController = require('../controllers/userController');
const router = express.Router();
const auth = require('../middleware/auth');

// ✅ Route for user signup with address validation
router.post(
  '/signup',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('surname', 'Surname is required').not().isEmpty(),
    check('contact', 'Contact is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters long').isLength({ min: 6 }),

    // ✅ Address validation
    check('address.street', 'Street is required').not().isEmpty(),
    check('address.city', 'City is required').not().isEmpty(),
    check('address.province', 'Province is required').not().isEmpty(),
    check('address.postalCode', 'Postal Code is required').not().isEmpty(),
    check('address.country', 'Country is required').not().isEmpty(),
  ],
  userController.signUp
);

// ✅ Login route
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  userController.login
);

// ✅ User profile and admin routes
router.get('/me', auth, userController.getCurrentUser); // Get current user
router.get('/users', userController.getAllUsers);       // Get all users
router.get('/users/:id', userController.getUserById);   // Get single user
router.put('/users/:id', userController.updateUser);    // Update user
router.delete('/users/:id', userController.deleteUser); // Delete user

module.exports = router;
