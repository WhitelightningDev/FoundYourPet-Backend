require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path'); // ✅ Required to define static folder paths

const userRoutes = require('./routes/userRoutes');
const petRoutes = require('./routes/petRoutes');
const authenticate = require('./middleware/auth');
const admin = require('./middleware/admin');
const addOnRoutes = require('./routes/addOnRoutes');
const packageRoutes = require('./routes/packageRoutes');
const publicPetRoutes = require('./routes/publicPetRoutes');
const cloudinary = require('cloudinary').v2;

const app = express();

// Cloudinary configuration
// Load environment variables from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,  // Cloud name from .env
  api_key: process.env.CLOUDINARY_API_KEY,        // API key from .env
  api_secret: process.env.CLOUDINARY_API_SECRET   // API secret from .env
});


// Body parser and limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(bodyParser.json());

// CORS
app.use(cors());

// ✅ Serve uploaded pet images as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/pets/public', publicPetRoutes); // ✅ Public route (no auth)
app.use('/api/pets', authenticate, petRoutes); // ✅ Authenticated
app.use('/api/addons', addOnRoutes);
app.use('/api/packages', packageRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('API is running');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ msg: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ msg: 'Something went wrong' });
});

// JWT_SECRET check
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('JWT_SECRET is not defined in environment variables');
  process.exit(1);
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
