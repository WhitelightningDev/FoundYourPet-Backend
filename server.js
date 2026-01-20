const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') }); // Load env regardless of CWD

const mongoose = require('mongoose');
const app = require('./app');

async function start() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;

  const missing = [];
  if (!mongoUri) missing.push('MONGO_URI (or MONGODB_URI/DATABASE_URL)');
  if (!jwtSecret) missing.push('JWT_SECRET');

  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(
        ', '
      )}. Set them in the environment or in ${path.resolve(__dirname, '.env')}`
    );
  }

  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');

  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled promise rejection:', err);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
  });

  start().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = app;
