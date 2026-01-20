const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

router.post('/createCheckout', auth, paymentController.createCheckoutSession);
router.post('/pay', auth, paymentController.confirmPayment);
router.get('/details/:paymentId', auth, paymentController.getPaymentDetails); // Add this
router.get('/tag-orders/:paymentId', auth, paymentController.getUserTagOrder);
router.get('/admin/tag-orders', auth, admin, paymentController.getAdminTagOrders);
router.patch('/admin/tag-orders/:paymentId/fulfillment', auth, admin, paymentController.updateTagOrderFulfillment);


module.exports = router;
 
