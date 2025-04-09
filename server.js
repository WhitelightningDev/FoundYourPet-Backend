require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');  // Import cors
const userRoutes = require('./routes/userRoutes');
const petRoutes = require('./routes/petRoutes'); // Import pet routes
const authenticate = require('./middleware/auth'); // Import authentication middleware

// Initialize Express app
const app = express();

// Enable CORS for all routes and origins (you can restrict it to specific origins later)
app.use(cors());  // Use CORS middleware

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

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// Use routes for user-related API calls
app.use('/api/users', userRoutes);

// Use routes for pet-related API calls
// The 'authenticate' middleware is applied here to ensure only authenticated users can access pet routes
app.use('/api/pets', authenticate, petRoutes); // Use the authentication middleware before pet routes

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
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
