const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Payment = require('../models/Payment');

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) throw new Error('Missing MongoDB connection string (set MONGO_URI, MONGODB_URI, or DATABASE_URL)');

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const filter = {
    kind: 'tag',
    status: 'successful',
    $or: [
      { 'fulfillment.status': { $exists: false } },
      { 'fulfillment.status': null },
      { fulfillment: { $exists: false } },
    ],
  };

  const now = new Date();

  const result = await Payment.collection.updateMany(
    filter,
    [
      {
        $set: {
          'fulfillment.provider': 'pudo',
          'fulfillment.status': 'unfulfilled',
          'fulfillment.createdAt': { $ifNull: ['$fulfillment.createdAt', { $ifNull: ['$processedAt', '$createdAt'] }] },
          'fulfillment.updatedAt': { $ifNull: ['$fulfillment.updatedAt', now] },
        },
      },
    ],
    { bypassDocumentValidation: true }
  );

  console.log('Backfill complete', {
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });

