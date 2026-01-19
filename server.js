require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const userRoutes = require('./routes/userRoutes');
const petRoutes = require('./routes/petRoutes');
const authenticate = require('./middleware/auth');
const addOnRoutes = require('./routes/addOnRoutes');
const packageRoutes = require('./routes/packageRoutes');
const publicPetRoutes = require('./routes/publicPetRoutes');
const cloudinary = require('cloudinary').v2;
const emailRoutes = require("./routes/email");
const paymentRoutes = require('./routes/payment');

const Payment = require('./models/Payment');
const Pet = require('./models/Pet');
const User = require('./models/User');

const app = express();

app.disable('x-powered-by');

// ✅ Required env vars
for (const key of ['MONGO_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`${key} is not defined in environment variables`);
    process.exit(1);
  }
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// ✅ Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Middleware for JSON parsing (rawBody captured for webhook validation only)
app.use(express.json({
  limit: "10mb",
  verify: (req, res, buf) => {
    if (req.originalUrl === '/api/payment/webhook') req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ CORS setup
app.use(cors());

// ✅ Static files for pet images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// ✅ Request logging middleware
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});


// ✅ Yoco Webhook Endpoint
app.post("/api/payment/webhook", async (req, res) => {
  const event = req.body;

  console.log("[Webhook] Event received:", event?.eventType);

  if (event.eventType === 'charge.successful') {
    const chargeData = event.data;

    try {
      const {
        metadata: { userId, pets, membershipId, paymentId },
        amount,
        id: yocoChargeId
      } = chargeData;

      // ✅ Update Payment record
      await Payment.findOneAndUpdate(
        paymentId ? { _id: paymentId } : { userId, amountInCents: amount },
        { status: 'successful', yocoChargeId }
      );

      // ✅ Update Pets
      await Pet.updateMany(
        { _id: { $in: pets } },
        {
          $set: {
            hasMembership: true,
            membership: membershipId,
            membershipStartDate: new Date(),
            tagType: "Standard"
          }
        }
      );

      // ✅ Update User
      await User.findByIdAndUpdate(userId, {
        membershipActive: true,
        membershipStartDate: new Date(),
      });

      console.log(`[Webhook] Processed successfully for user: ${userId}`);
      return res.sendStatus(200);
    } catch (err) {
      console.error("[Webhook] Processing failed:", err.message);
      return res.sendStatus(500);
    }
  }

  // Respond to non-matching events to avoid retries
  return res.sendStatus(200);
});


// ✅ Route registration
app.use('/api/payment', paymentRoutes);
app.use('/api/memberships', require('./routes/membershipRoutes'));
app.use("/api/email", emailRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pets/public', publicPetRoutes);
app.use('/api/pets', authenticate, petRoutes);
app.use('/api/addons', addOnRoutes);
app.use('/api/packages', packageRoutes);

// ✅ Health check route
app.get('/', (req, res) => {
  res.send('API is running');
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ msg: 'Route not found' });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ msg: 'Something went wrong' });
});

// ✅ Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
