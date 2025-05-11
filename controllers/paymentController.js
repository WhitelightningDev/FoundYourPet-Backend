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
  const { token, amountInCents, userId, petIds, membershipId } = req.body;

  try {
    // 1. Charge the card using Yoco
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

    // 2. Proceed only if payment succeeded
    if (response.data.status === 'successful') {
      console.log("Incoming body at /payment/success:", req.body);

      // 3. Update the payment record to mark as successful
      await Payment.findOneAndUpdate(
        { userId, amountInCents }, // matching by user and amount, assuming these are unique per payment
        { status: 'successful', yocoChargeId: response.data.id }
      );

      // 4. Check that the membership exists
      const membership = await Membership.findById(membershipId);
      if (!membership) {
        return res.status(400).json({ success: false, message: 'Invalid membership ID' });
      }

      // 5. Update all pets with membership info (only pets that belong to the current user)
      await Pet.updateMany(
        { _id: { $in: petIds }, userId: userId },
        {
          $set: {
            hasMembership: true,  // Set pet membership as true
            membership: membership._id,  // Link pet to the membership
            membershipStartDate: new Date(),  // Set the start date of membership
            tagType: "standard",  // Assuming all new pets get the standard tag
          }
        }
      );

      // 6. Update the user as well
      await User.findByIdAndUpdate(userId, {
        membershipActive: true,  // Mark user's membership as active
        membershipStartDate: new Date(),  // Set the user's membership start date
      });

      res.status(200).json({
        success: true,
        message: 'Payment and pet membership update successful',
        data: response.data,
      });
    } else {
      res.status(400).json({ success: false, message: 'Payment failed', data: response.data });
    }
  } catch (error) {
    console.error('Payment processing error:', error?.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Payment processing failed' });
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
