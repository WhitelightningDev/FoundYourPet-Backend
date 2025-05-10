const express = require('express');
const router = express.Router();
const { createCheckoutSession, confirmPayment } = require('../controllers/paymentController');

router.post('/createCheckout', createCheckoutSession);
router.post('/pay', confirmPayment);

module.exports = router;
