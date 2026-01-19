require('dotenv').config(); // Load environment variables from .env file

const mongoose = require('mongoose');
const app = require('./app');

async function start() {
  for (const key of ['MONGO_URI', 'JWT_SECRET']) {
    if (!process.env[key]) {
      throw new Error(`${key} is not defined in environment variables`);
    }
  }

  await mongoose.connect(process.env.MONGO_URI);
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
