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

const Payment = require('./models/Payment');
const Pet = require('./models/Pet');
const User = require('./models/User');

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

  console.log("[Webhook] Event received:", event?.eventType);

  if (event.eventType === 'charge.successful') {
    const chargeData = event.data;

    try {
      const {
        metadata,
        amount,
        id: yocoChargeId
      } = chargeData;

      const paymentId = metadata?.paymentId;
      if (!paymentId) {
        console.warn('[Webhook] Missing paymentId in metadata; skipping DB updates');
        return res.sendStatus(200);
      }

      const payment = await Payment.findById(paymentId);
      if (!payment) {
        console.warn(`[Webhook] Payment not found: ${paymentId}`);
        return res.sendStatus(200);
      }

      const paymentKind =
        payment.kind || (payment.membership || metadata?.membershipId ? 'membership' : 'tag');

      const petIds = Array.isArray(payment.petIds) && payment.petIds.length
        ? payment.petIds
        : (Array.isArray(metadata?.pets) ? metadata.pets : []);

      await Payment.findByIdAndUpdate(paymentId, {
        status: 'successful',
        yocoChargeId,
        updatedAt: new Date(),
      });

      if (paymentKind === 'membership') {
        const membershipId = payment.membership || metadata?.membershipId || null;
        if (membershipId && !payment.membership) {
          await Payment.findByIdAndUpdate(paymentId, { membership: membershipId, updatedAt: new Date() });
        }

        await Pet.updateMany(
          { _id: { $in: petIds }, userId: payment.userId },
          {
            $set: {
              hasMembership: true,
              membership: membershipId,
              membershipStartDate: new Date(),
            }
          }
        );

        const activePet = await Pet.findOne({ userId: payment.userId, hasMembership: true }).select('_id');
        await User.findByIdAndUpdate(payment.userId, {
          membershipActive: !!activePet,
          membershipStartDate: !!activePet ? new Date() : null,
        });
      } else if (paymentKind === 'tag') {
        const normalizedPackageType = (payment.packageType || metadata?.packageType || '').toString().toLowerCase();
        const tagType =
          metadata?.tagType ||
          (normalizedPackageType.includes('airtag') && normalizedPackageType.includes('apple')
            ? 'Apple AirTag'
            : normalizedPackageType.includes('smart') && normalizedPackageType.includes('samsung')
              ? 'Samsung SmartTag'
              : normalizedPackageType.includes('tag')
                ? 'Standard'
                : null);

        await Pet.updateMany(
          { _id: { $in: petIds }, userId: payment.userId },
          {
            $set: {
              hasTag: true,
              tagType,
              tagPurchaseDate: new Date(),
            }
          }
        );
      }

      console.log(`[Webhook] Processed successfully for payment: ${paymentId}`);
      return res.sendStatus(200);
    } catch (err) {
      console.error("[Webhook] Processing failed:", err.message);
      return res.sendStatus(500);
    }
  }

  return res.sendStatus(200);
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
