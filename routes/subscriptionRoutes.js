const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');

router.post('/checkout', auth, subscriptionController.createMySubscriptionCheckout);
router.get('/checkout/:token', subscriptionController.renderCheckoutPage);
router.get('/me', auth, subscriptionController.getMySubscription);
router.post('/cancel', auth, subscriptionController.cancelMySubscription);

module.exports = router;
