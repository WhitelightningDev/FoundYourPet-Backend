const User = require('../models/User');
const jwt = require('jsonwebtoken');
// const bcrypt = require('bcrypt');
const Pet = require("../models/Pet");
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendEmail, sendSignupSuccessEmail } = require("../services/mailService");


const { validationResult } = require('express-validator');

// Advanced Error Handler
const errorHandler = (res, error, message = 'Server error', statusCode = 500) => {
  console.error(error.message || error);
  return res.status(statusCode).json({ msg: message, message, error: error.message });
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

    const backendUrl = (process.env.BACKEND_URL || 'https://foundyourpet-backend.onrender.com').toString().replace(/\/+$/, '');
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerificationTokenHash: verificationHash,
          emailVerificationExpires: verificationExpires,
          verificationEmailSentAt: new Date(),
          emailVerified: false,
        },
      }
    );

    const verifyUrl = `${backendUrl}/api/users/verify-email/${verificationToken}`;

    // 🎉 Trigger signup email in background (do not block signup response)
    setImmediate(async () => {
      try {
        await sendSignupSuccessEmail({
          to: user.email,
          name: user.name || 'there',
          verifyUrl,
        });
      } catch (emailError) {
        console.warn("Signup email failed:", emailError?.message || emailError);
      }
    });

    const safeUser = {
      _id: user._id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      isAdmin: user.isAdmin,
      membershipStartDate: user.membershipStartDate || null,
      membershipActive: user.membershipActive || false,
      contact: user.contact,
      address: user.address,
    };

    return res.status(201).json({
      msg: 'User registered successfully!',
      message: 'User registered successfully!',
      user: safeUser,
    });
  } catch (err) {
    return errorHandler(res, err);
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email });
    // Always respond 200 to avoid leaking whether an email exists.
    if (!user) return res.status(200).json({ success: true, message: 'If an account exists, we sent a verification email.' });

    if (user.emailVerified) {
      return res.status(200).json({ success: true, message: 'Email already verified.' });
    }

    const lastSentAt = user.verificationEmailSentAt ? new Date(user.verificationEmailSentAt).getTime() : 0;
    const nowMs = Date.now();
    if (lastSentAt && nowMs - lastSentAt < 60_000) {
      const retryAfterSeconds = Math.max(1, Math.ceil((60_000 - (nowMs - lastSentAt)) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      // Return 200 here so clients don't spam fallback endpoints on a cooldown window.
      return res.status(200).json({
        success: true,
        cooldown: true,
        retryAfterSeconds,
        message: 'Verification email was sent recently. Please check your inbox and try again shortly.',
      });
    }

    const backendUrl = (process.env.BACKEND_URL || 'https://foundyourpet-backend.onrender.com').toString().replace(/\/+$/, '');
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerificationTokenHash: verificationHash,
          emailVerificationExpires: verificationExpires,
          verificationEmailSentAt: new Date(),
          emailVerified: false,
        },
      }
    );

    const verifyUrl = `${backendUrl}/api/users/verify-email/${verificationToken}`;

    await sendSignupSuccessEmail({
      to: user.email,
      name: user.name || 'there',
      verifyUrl,
    });

    return res.status(200).json({ success: true, message: 'Verification email sent.' });
  } catch (err) {
    return errorHandler(res, err, 'Failed to send verification email');
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const token = (req.params?.token || '').toString().trim();
    if (!token) return res.status(400).send('Missing token');

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    });

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').toString().replace(/\/+$/, '');

    if (!user) {
      return res.redirect(302, `${frontendUrl}/login?verified=0`);
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: { emailVerified: true },
        $unset: { emailVerificationTokenHash: '', emailVerificationExpires: '' },
      }
    );

    return res.redirect(302, `${frontendUrl}/login?verified=1`);
  } catch (err) {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').toString().replace(/\/+$/, '');
    return res.redirect(302, `${frontendUrl}/login?verified=0`);
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
      return res.status(401).json({ msg: 'Invalid credentials', message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: 'Invalid credentials', message: 'Invalid credentials' });
    }

    const payload = {
      userId: user._id,
      isAdmin: user.isAdmin,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({
      msg: 'Login successful',
      message: 'Login successful',
      user: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        isAdmin: user.isAdmin,
        membershipStartDate: user.membershipStartDate || null,
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
    const safeUser = {
      _id: user._id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      isAdmin: user.isAdmin,
      membershipStartDate: user.membershipStartDate || null,
      membershipActive: user.membershipActive || false,
      contact: user.contact,
      address: user.address,
    };
    return res.status(200).json({
      msg: 'User updated successfully',
      message: 'User updated successfully',
      user: safeUser,
    });

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
        surname: user.surname,
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

    await Pet.deleteMany({ userId: user._id });
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

    // Fetch the user + pets via virtual populate
    const user = await User.findById(userId).select('-password').populate('pets');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ user, pets: user.pets || [] });
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    await sendEmail(
      email,
      'Password Reset Request',
      `You requested a password reset. Use this link to reset your password: ${resetUrl}`,
      `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a></p>`
    );
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
    const paymentId = req.body?.paymentId;
    if (!paymentId) {
      return res.status(400).json({ msg: "Missing paymentId" });
    }

    const Payment = require('../models/Payment');
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ msg: "Payment not found" });
    }

    const requesterUserId = req.user?.userId;
    if (!req.user?.isAdmin && payment.userId.toString() !== requesterUserId) {
      return res.status(403).json({ msg: "Not authorized to activate this payment" });
    }

    if (payment.kind !== 'membership' || payment.status !== 'successful') {
      return res.status(400).json({ msg: "Payment is not a successful membership purchase" });
    }

    const user = await User.findById(payment.userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const hasActivePetMembership = await Pet.exists({ userId: user._id, hasMembership: true });
    user.membershipActive = !!hasActivePetMembership;
    user.membershipStartDate = hasActivePetMembership ? new Date() : null;
    await user.save();

    return res.status(200).json({ msg: "Membership status synced", user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Server error" });
  }
};
