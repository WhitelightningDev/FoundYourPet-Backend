const express = require('express');
const cors = require('cors');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const userRoutes = require('./routes/userRoutes');
const petRoutes = require('./routes/petRoutes');
const authenticate = require('./middleware/auth');
const addOnRoutes = require('./routes/addOnRoutes');
const packageRoutes = require('./routes/packageRoutes');
const publicPetRoutes = require('./routes/publicPetRoutes');
const emailRoutes = require("./routes/email");
const paymentRoutes = require('./routes/payment');
const reportRoutes = require("./routes/reportRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const { finalizeSuccessfulPayment } = require('./services/paymentFinalizer');

const app = express();

app.disable('x-powered-by');

// Cloudinary configuration (safe even if env vars are unset; requests that use it will fail later)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// JSON parsing (rawBody captured for webhook validation only)
app.use(express.json({
  limit: "10mb",
  verify: (req, res, buf) => {
    if (req.originalUrl === '/api/payment/webhook') req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS setup
app.use(cors());

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// Yoco Webhook Endpoint
app.post("/api/payment/webhook", async (req, res) => {
  const event = req.body;

  const eventType = event?.eventType || event?.type || event?.event_type || null;
  console.log("[Webhook] Event received:", eventType);

  const successfulEventTypes = new Set([
    'charge.successful',
    'charge.succeeded',
    'charge.success',
    'checkout.completed',
    'checkout.successful',
    'checkout.succeeded',
  ]);

  if (!successfulEventTypes.has(eventType)) return res.sendStatus(200);

  try {
    const data = event?.data || {};
    const metadata = data?.metadata || event?.metadata || null;
    const paymentId = metadata?.paymentId || null;
    const yocoChargeId = data?.id || data?.chargeId || data?.charge_id || null;

    if (!paymentId) return res.sendStatus(200);

    const result = await finalizeSuccessfulPayment({ paymentId, yocoChargeId, metadata, now: new Date() });
    if (!result.ok) console.warn('[Webhook] Finalization skipped:', result.reason);
    return res.sendStatus(200);
  } catch (err) {
    console.error("[Webhook] Processing failed:", err.message);
    return res.sendStatus(500);
  }
});

// Route registration
app.use('/api/payment', paymentRoutes);
app.use('/api/memberships', require('./routes/membershipRoutes'));
app.use("/api/email", emailRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pets/public', publicPetRoutes);
app.use('/api/pets', authenticate, petRoutes);
app.use('/api/addons', addOnRoutes);
app.use('/api/packages', packageRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check route
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

module.exports = app;
