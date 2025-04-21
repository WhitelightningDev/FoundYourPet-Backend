// routes/payment.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/pay', async (req, res) => {
  const { token, amountInCents, currency = 'ZAR', userId, petId } = req.body;

  try {
    const response = await axios.post('https://online.yoco.com/v1/charges', {
      token,
      amountInCents,
      currency,
    }, {
      headers: {
        'X-Auth-Secret-Key': process.env.YOCO_SECRET_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.status === 'successful') {
      res.status(200).json({
        success: true,
        message: 'Payment successful',
        data: response.data,
        userId,
        petId
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment failed',
        data: response.data,
        userId,
        petId
      });
    }
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
