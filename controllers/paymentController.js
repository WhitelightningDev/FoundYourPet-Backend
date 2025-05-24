const axios = require('axios');
const Payment = require('../models/Payment');
const Pet = require('../models/Pet');
const Membership = require('../models/Membership');
const User = require('../models/User');



const createCheckoutSession = async (req, res) => {
  const { userId, petIds, amountInCents, packageType, billingDetails } = req.body;

  if (!userId || !petIds || !amountInCents || !packageType || !billingDetails) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    console.error('Missing FRONTEND_URL in environment variables');
    return res.status(500).json({ success: false, message: "Server misconfiguration: FRONTEND_URL is not set" });
  }

  try {
    // 1. Create a Membership before proceeding with the payment
    const membership = new Membership({
      name: `${packageType} Membership`,
      price: amountInCents / 100, // Assuming the amount is in cents, convert to currency
      features: ["24/7 support", "Lost pet alert"], // Example features, adjust as needed
      billingCycle: 'monthly', // Assuming the default cycle is monthly, adjust if necessary
    });

    // Save the new membership
    const newMembership = await membership.save();

    // 2. Save the payment record
    const payment = new Payment({
      userId,
      petIds,
      amountInCents,
      membership: newMembership._id, // Store the new membership ID here
      packageType,
    });
    await payment.save();

    // 3. Create the Yoco Checkout session
    const response = await axios.post('https://payments.yoco.com/api/checkouts', {
      amount: amountInCents,
      currency: 'ZAR',
      description: `Package: ${packageType} + Membership ID: ${newMembership._id}`,
      successUrl: `${frontendUrl}/payment-success?paymentId=${payment._id}`,
      cancelUrl: `${frontendUrl}/payment-cancel`,
      failureUrl: `${frontendUrl}/payment-failure`,
      metadata: {
        userId,
        packageType,
        membershipId: newMembership._id,
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

    // Return the checkout URL to redirect the user
    res.status(200).json({ checkout_url: response.data.redirectUrl });
  } catch (error) {
    console.error('Checkout creation error:', error?.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Checkout creation failed' });
  }
};



const confirmPayment = async (req, res) => {
  const { token, amountInCents, userId, petIds, membershipId, paymentId } = req.body;

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
      // Update payment by ID
      await Payment.findByIdAndUpdate(paymentId, {
        status: 'successful',
        yocoChargeId: response.data.id
      });

      const membership = await Membership.findById(membershipId);
      if (!membership) {
        return res.status(400).json({ success: false, message: 'Invalid membership ID' });
      }

      await Pet.updateMany(
        { _id: { $in: petIds }, userId },
        {
          $set: {
            hasMembership: true,
            membership: membership._id,
            membershipStartDate: new Date(),
            tagType: "standard",
          }
        }
      );

      await User.findByIdAndUpdate(userId, {
        membershipActive: true,
        membershipStartDate: new Date(),
      });

      return res.status(200).json({
        success: true,
        message: 'Payment and membership updated successfully',
        data: response.data,
      });
    } else {
      return res.status(400).json({ success: false, message: 'Payment failed', data: response.data });
    }
  } catch (error) {
    console.error('Payment processing error:', error?.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'Payment processing failed' });
  }
};



const getPaymentDetails = async (req, res) => {
  const { paymentId } = req.params;

  try {
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

    const user = await User.findById(payment.userId).select("firstName lastName email");
    const pets = await Pet.find({ _id: { $in: payment.petIds } }).select("name breed species size hasMembership");
    const membership = await Membership.findById(payment.membership);

    res.status(200).json({
      success: true,
      data: {
        user,
        pets,
        membership: {
          name: membership?.name || "Membership",
          active: true,
        },
        amountPaid: (payment.amountInCents / 100).toFixed(2),
        packageType: payment.packageType,
        status: payment.status,
      },
    });
  } catch (err) {
    console.error("Failed to retrieve payment details:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getPaymentDetails,
  createCheckoutSession,
  confirmPayment,

};
