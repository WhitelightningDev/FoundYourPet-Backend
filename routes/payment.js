const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

router.post('/createCheckout', auth, paymentController.createCheckoutSession);
router.post('/pay', auth, paymentController.confirmPayment);
router.get('/details/:paymentId', auth, paymentController.getPaymentDetails); // Add this


module.exports = router;
 
