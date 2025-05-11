const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/createCheckout', paymentController.createCheckoutSession);
router.post('/pay', paymentController.confirmPayment);
router.get('/details/:paymentId', paymentController.getPaymentDetails); // Add this


module.exports = router;
 