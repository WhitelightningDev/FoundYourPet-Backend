require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const userRoutes = require('./routes/userRoutes');

// Initialize Express app
const app = express();

// Middleware to parse incoming requests with JSON payloads
app.use(bodyParser.json());

// Connect to MongoDB using environment variable from .env file
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1); // Exit the process if MongoDB connection fails
  });

// Use routes for user-related API calls
app.use('/api', userRoutes);

// Default route for root
app.get('/', (req, res) => {
  res.send('API is running');
});

// Use JWT_SECRET from environment variables for future authentication purposes
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('JWT_SECRET is not defined in environment variables');
  process.exit(1); // Exit if JWT_SECRET is not set
}

// Define the port (default to 5000 if not specified in .env)
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
