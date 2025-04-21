const express = require('express');
const axios = require('axios');
const router = express.Router();

// Function to create a checkout session
const createCheckout = async (amountInCents, currency, userId, petIds, membership, packageType) => {
  try {
    // Create checkout session with Yoco
    const response = await axios.post('https://payments.yoco.com/api/checkouts', {
      amount_in_cents: amountInCents,
      currency: currency,
      description: `Package: ${packageType}, Membership: ${membership}`,
      user_id: userId,
      pet_ids: petIds,
      // Any other details you want to send
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.YOCO_SECRET_KEY}`,  // Use Yoco Secret Key
        'Content-Type': 'application/json',
        'Idempotency-Key': `${userId}-${Date.now()}`,  // Optional, for safely retrying requests
      }
    });

    // Return the checkout URL from Yoco
    return response.data.checkout_url;
  } catch (err) {
    console.error('Error creating checkout:', err?.response?.data || err.message);
    throw new Error('Error creating checkout');
  }
};

// Route to create a checkout session
router.post('/createCheckout', async (req, res) => {
  const { userId, petIds, amountInCents, membership, packageType } = req.body;

  try {
    const checkoutUrl = await createCheckout(amountInCents, 'ZAR', userId, petIds, membership, packageType);

    // Send the checkout URL to the frontend
    res.status(200).json({ checkout_url: checkoutUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error creating checkout' });
  }
});

// Route to confirm payment after checkout
router.post('/pay', async (req, res) => {
  const { token, amountInCents, currency = 'ZAR', userId, petId } = req.body;

  try {
    // Verify payment with Yoco
    const response = await axios.post('https://online.yoco.com/v1/charges', {
      token,
      amount_in_cents: amountInCents,
      currency,
    }, {
      headers: {
        'X-Auth-Secret-Key': process.env.YOCO_SECRET_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.status === 'successful') {
      // Payment is successful
      res.status(200).json({
        success: true,
        message: 'Payment successful',
        data: response.data,
        userId,
        petId
      });
    } else {
      // Payment failed
      res.status(400).json({
        success: false,
        message: 'Payment failed',
        data: response.data,
        userId,
        petId
      });
    }
  } catch (err) {
    console.error('Error processing payment:', err?.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
