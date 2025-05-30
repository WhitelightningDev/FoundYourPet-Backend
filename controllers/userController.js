const User = require('../models/user');  // Ensure the path is correct and case-sensitive
const jwt = require('jsonwebtoken');
// const bcrypt = require('bcrypt');
const Pet = require("../models/Pet");
const bcrypt = require('bcryptjs');
const sendWelcomeEmail  = require("../services/mailService");
const nodemailer = require('nodemailer');


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
      address,
      privacyPolicy: true,
      termsConditions: true,
      agreement: true
    });

    await user.save();

    // 🎉 Trigger welcome email after saving user
    await sendWelcomeEmail(user.email, user.name);

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

    const payload = {
      userId: user._id,
      isAdmin: user.isAdmin,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({
      msg: 'Login successful',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        membershipStartDate: user.membershipStartDate || false,
        membershipActive: user.membershipActive || false, // include membership status
        contact: user.contact,
        address: user.address,
      },
      token,
    });
  } catch (err) {
    return errorHandler(res, err);
  }
};



// GET /api/admin/users (Retrieve all users, only accessible by admin)
exports.getAllUsers = async (req, res) => {
  try {
    // Ensure the user is an admin
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ msg: 'Access denied. Admins only.' });
    }

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
  try {
    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Basic fields
    user.name = req.body.name || user.name;
    user.surname = req.body.surname || user.surname;
    user.email = req.body.email || user.email;
    user.contact = req.body.contact || user.contact;

    // Secure password update
    if (req.body.password && req.body.password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    // Address update with validation
    if (req.body.address) {
      const { street, city, province, postalCode, country } = req.body.address;
      if (!street || !city || !province || !postalCode || !country) {
        return res.status(400).json({ msg: 'All address fields are required, including country.' });
      }

      user.address = { street, city, province, postalCode, country };
    }

    await user.save();
    return res.status(200).json({ msg: 'User updated successfully', user });

  } catch (err) {
    return errorHandler(res, err);
  }
};


exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    return res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        membershipStartDate: user.membershipStartDate, 
        membershipActive: user.membershipActive || false,
        contact: user.contact,
        address: user.address,
      }
    });
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


// GET /api/users/:id/with-pets (Get a user and their pets)
exports.getUserWithPets = async (req, res) => {
  try {
    const userId = req.params.id;

    // Fetch the user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Fetch pets associated with the user
    const pets = await Pet.find({ userId: userId });

    res.status(200).json({ user, pets });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Request password reset
exports.requestPasswordReset = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // Token valid for 1 hour
    await user.save();

    // Send email with reset token
    const resetUrl = `http://yourfrontend.com/reset-password/${resetToken}`;

    // Setup mail transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      to: email,
      from: 'no-reply@yourapp.com',
      subject: 'Password Reset Request',
      text: `You requested a password reset. Please click the link to reset your password: ${resetUrl}`,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ msg: 'Password reset link sent' });
  } catch (err) {
    return errorHandler(res, err);
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { password } = req.body;
  const { token } = req.params;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Check if the token is still valid
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired reset token' });
    }

    // Hash the new password and save
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined; // Clear reset token
    user.resetPasswordExpires = undefined; // Clear expiration time
    await user.save();

    return res.status(200).json({ msg: 'Password has been reset' });
  } catch (err) {
    return errorHandler(res, err);
  }
};

exports.activateMembership = async (req, res) => {
  try {
    const { userId } = req.body; // pass userId from frontend or payment service webhook

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    user.membershipActive = true;
    user.membershipStartDate = new Date();

    await user.save();

    return res.status(200).json({ msg: "Membership activated", user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Server error" });
  }
};