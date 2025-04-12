const User = require('../models/user');  // Ensure the path is correct and case-sensitive
const jwt = require('jsonwebtoken');
// const bcrypt = require('bcrypt');
const bcrypt = require('bcryptjs');

const { validationResult } = require('express-validator');

// Advanced Error Handler
const errorHandler = (res, error, message = 'Server error', statusCode = 500) => {
  console.error(error.message || error);
  return res.status(statusCode).json({ msg: message, error: error.message });
};

// POST /api/signup (Create a new user)
exports.signUp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, surname, contact, email, password, address } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      surname,
      email,
      contact,
      password: hashedPassword,
      address, // Store address here
      privacyPolicy: true,
      termsConditions: true,
      agreement: true
    });

    await user.save();
    return res.status(201).json({ msg: 'User registered successfully!', user });
  } catch (err) {
    return errorHandler(res, err);
  }
};


exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // ✅ Generate JWT
    const payload = { userId: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({
      msg: 'Login successful',
      user,
      token, // ✅ Send the token to the frontend
    });
  } catch (err) {
    return errorHandler(res, err);
  }
};

// GET /api/users (Retrieve all users)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Exclude passwords
    return res.status(200).json(users);
  } catch (err) {
    return errorHandler(res, err);
  }
};

// GET /api/users/:id (Retrieve a single user by ID)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password'); // Exclude password
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    return res.status(200).json(user);
  } catch (err) {
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'User not found' });
    }
    return errorHandler(res, err);
  }
};

// PUT /api/users/:id (Update user data)
exports.updateUser = async (req, res) => {
  const { name, surname, email } = req.body;

  try {
    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Update user details
    user.name = name || user.name;
    user.surname = surname || user.surname;
    user.email = email || user.email;

    await user.save();
    return res.status(200).json({ msg: 'User updated successfully', user });
  } catch (err) {
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'User not found' });
    }
    return errorHandler(res, err);
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    // Make sure to fetch user data using the userId in req.user
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    return res.status(200).json(user);  // Return user data without password
  } catch (err) {
    return errorHandler(res, err);
  }
};


// DELETE /api/users/:id (Delete a user)
exports.deleteUser = async (req, res) => {
  try {
    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    await user.remove();
    return res.status(200).json({ msg: 'User deleted successfully' });
  } catch (err) {
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'User not found' });
    }
    return errorHandler(res, err);
  }
};
