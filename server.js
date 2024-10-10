// server.js or app.js (your main server file)

require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const mongoose = require('mongoose');

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

// Use JWT_SECRET from environment variables for authentication
const jwtSecret = process.env.JWT_SECRET;
