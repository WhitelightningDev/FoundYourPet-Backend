// controllers/userController.js

const User = require('../models/user');
const bcrypt = require('bcrypt');

// POST /api/signup
exports.signUp = async (req, res) => {
  try {
    const { name, surname, contact, email, password, privacyPolicy, termsConditions, agreement } = req.body;

    // Check if the user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user
    user = new User({
      name,
      surname,
      contact,
      email,
      password: hashedPassword,
      privacyPolicy,
      termsConditions,
      agreement,
    });

    await user.save();

    res.status(201).json({ msg: 'User registered successfully!' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
