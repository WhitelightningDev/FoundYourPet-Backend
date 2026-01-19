/* eslint-disable no-console */

// Minimal smoke test: ensure modules load without starting the server.
try {
  require('../app');
  require('../models/User');
  require('../models/Pet');
  require('../models/Payment');
  require('../controllers/userController');
  require('../controllers/petController');
  require('../controllers/paymentController');
  console.log('smoke ok');
  process.exit(0);
} catch (err) {
  console.error('smoke failed:', err);
  process.exit(1);
}

