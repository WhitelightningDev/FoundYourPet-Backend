// routes/userRoutes.js

const express = require('express');
const { check } = require('express-validator');
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

/**
 * @route   POST /api/users/signup
 * @desc    Register a new user
 */
router.post(
  '/signup',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('surname', 'Surname is required').not().isEmpty(),
    check('contact', 'Contact is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters long').isLength({ min: 6 }),
    check('address.street', 'Street is required').not().isEmpty(),
    check('address.city', 'City is required').not().isEmpty(),
    check('address.province', 'Province is required').not().isEmpty(),
    check('address.postalCode', 'Postal Code is required').not().isEmpty(),
    check('address.country', 'Country is required').not().isEmpty(),
  ],
  userController.signUp
);

/**
 * @route   POST /api/users/login
 * @desc    Login and get token
 */
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  userController.login
);

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 */
router.get('/', auth, admin, userController.getAllUsers);

/**
 * @route   GET /api/users/me
 * @desc    Get current user's profile
 */
router.get('/me', auth, userController.getCurrentUser);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID (admin only)
 */
router.get('/:id', auth, admin, userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile (self only)
 */
router.put('/:id', auth, (req, res, next) => {
  if (req.user.userId !== req.params.id) {
    return res.status(403).json({ msg: 'You can only update your own profile' });
  }
  next();
}, userController.updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (self or admin)
 */
router.delete('/:id', auth, (req, res, next) => {
  if (req.user.userId !== req.params.id && !req.user.isAdmin) {
    return res.status(403).json({ msg: 'You can only delete your own profile or be an admin to delete others' });
  }
  next();
}, userController.deleteUser);

// ✅ Admin-only route to get a user with their pets
router.get('/users/:id/with-pets', auth, admin, userController.getUserWithPets);


module.exports = router;
