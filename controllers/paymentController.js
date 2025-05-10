const axios = require('axios');
const Payment = require('../models/Payment');

const createCheckoutSession = async (req, res) => {
  const { userId, petIds, amountInCents, membership, packageType, billingDetails } = req.body;

  // Validate required fields
  if (!userId || !petIds || !amountInCents || membership === undefined || !packageType || !billingDetails) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  // Ensure FRONTEND_URL is available
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    console.error('Missing FRONTEND_URL in environment variables');
    return res.status(500).json({ success: false, message: "Server misconfiguration: FRONTEND_URL is not set" });
  }

  try {
    // Save payment to database before initiating checkout session
    const payment = new Payment({ userId, petIds, amountInCents, membership, packageType });
    await payment.save();

    // Prepare the request body for Yoco Checkout API with correct frontend URLs
    const response = await axios.post('https://payments.yoco.com/api/checkouts', {
      amount: amountInCents,
      currency: 'ZAR',
      description: `Package: ${packageType} + Membership: ${membership ? 'Yes' : 'No'}`,
      successUrl: `${frontendUrl}/payment-success`,
      cancelUrl: `${frontendUrl}/payment-cancel`,
      failureUrl: `${frontendUrl}/payment-failure`,
      metadata: {
        userId,
        packageType,
        membership,
        pets: petIds,
      },
      billingDetails,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.YOCO_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `${userId}-${Date.now()}`,
      }
    });

    res.status(200).json({ checkout_url: response.data.redirectUrl });
  } catch (error) {
    console.error('Checkout creation error:', error?.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Checkout creation failed' });
  }
};

const confirmPayment = async (req, res) => {
  const { token, amountInCents, userId, petId } = req.body;

  try {
    const response = await axios.post('https://online.yoco.com/v1/charges', {
      token,
      amount_in_cents: amountInCents,
      currency: 'ZAR',
    }, {
      headers: {
        'X-Auth-Secret-Key': process.env.YOCO_SECRET_KEY,
        'Content-Type': 'application/json',
      }
    });

    if (response.data.status === 'successful') {
      await Payment.findOneAndUpdate(
        { userId, petIds: petId, amountInCents },
        { status: 'successful', yocoChargeId: response.data.id }
      );

      res.status(200).json({ success: true, message: 'Payment successful', data: response.data });
    } else {
      res.status(400).json({ success: false, message: 'Payment failed', data: response.data });
    }
  } catch (error) {
    console.error('Payment processing error:', error?.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Payment processing failed' });
  }
};

module.exports = {
  createCheckoutSession,
  confirmPayment,
};
