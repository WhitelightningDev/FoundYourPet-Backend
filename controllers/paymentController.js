const axios = require('axios');
const Payment = require('../models/Payment');
const Pet = require('../models/Pet');
const Membership = require('../models/Membership');
const User = require('../models/User');

const normalizeBool = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = (value || '').toString().trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return false;
};

const getSubscriptionPriceForPet = (pet) => {
  const size = (pet?.size || '').toString().trim().toLowerCase();
  if (size === 'small') return 50;
  if (size === 'medium') return 70;
  if (size === 'large') return 100;
  return null;
};

const getTagTypeFromPackageType = (packageType) => {
  const normalized = (packageType || '').toString().trim().toLowerCase();
  if (normalized.includes('airtag') && normalized.includes('apple')) return 'Apple AirTag';
  if (normalized.includes('smart') && normalized.includes('samsung')) return 'Samsung SmartTag';
  if (normalized.includes('tag')) return 'Standard';
  return null;
};

const createCheckoutSession = async (req, res) => {
  const userId = req.userId;
  const { petIds, amountInCents, packageType, billingDetails } = req.body;
  const membership = normalizeBool(req.body.membership);

  if (!userId || !petIds || !amountInCents || !packageType || !billingDetails) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    console.error('Missing FRONTEND_URL in environment variables');
    return res.status(500).json({ success: false, message: "Server misconfiguration: FRONTEND_URL is not set" });
  }

  try {
    if (!Array.isArray(petIds) || petIds.length === 0) {
      return res.status(400).json({ success: false, message: "petIds must be a non-empty array" });
    }

    const pets = await Pet.find({ _id: { $in: petIds }, userId });
    if (pets.length !== petIds.length) {
      return res.status(400).json({ success: false, message: "One or more pets were not found for this user" });
    }

    let paymentKind = membership ? 'membership' : 'tag';
    let finalAmountInCents = Number(amountInCents);
    let membershipDoc = null;

    if (membership) {
      if (petIds.length !== 1) {
        return res.status(400).json({ success: false, message: "Membership checkout supports exactly one pet" });
      }

      const pet = pets[0];
      if (pet.hasMembership) {
        return res.status(409).json({ success: false, message: "This pet already has an active subscription" });
      }

      const monthlyPrice = getSubscriptionPriceForPet(pet);
      if (!monthlyPrice) {
        return res.status(400).json({
          success: false,
          message: "Pet size must be set to Small / Medium / Large before subscribing",
        });
      }

      const normalizedSize = pet.size.toLowerCase();
      const planName =
        normalizedSize === 'small'
          ? 'Small Pet Subscription'
          : normalizedSize === 'medium'
            ? 'Medium Pet Subscription'
            : 'Large Pet Subscription';

      membershipDoc = await Membership.findOneAndUpdate(
        { name: planName, billingCycle: 'monthly' },
        {
          $setOnInsert: {
            name: planName,
            price: monthlyPrice,
            billingCycle: 'monthly',
            features: ['Pet profile hosting', 'Lost pet alert', 'Priority support'],
          },
        },
        { upsert: true, new: true }
      );

      finalAmountInCents = monthlyPrice * 100;
    } else {
      const petsWithoutMembership = pets.filter((p) => !p.hasMembership).map((p) => p._id.toString());
      if (petsWithoutMembership.length) {
        return res.status(400).json({
          success: false,
          message: "All selected pets must have an active subscription before ordering tags",
          petsMissingSubscription: petsWithoutMembership,
        });
      }
    }

    if (!Number.isFinite(finalAmountInCents) || finalAmountInCents <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amountInCents" });
    }

    const payment = await Payment.create({
      userId,
      petIds,
      kind: paymentKind,
      amountInCents: finalAmountInCents,
      membership: membershipDoc?._id || null,
      packageType,
    });

    // 3. Create the Yoco Checkout session
    const response = await axios.post('https://payments.yoco.com/api/checkouts', {
      amount: finalAmountInCents,
      currency: 'ZAR',
      description: membership
        ? `Subscription: ${membershipDoc?.name || packageType} + Payment ID: ${payment._id}`
        : `Order: ${packageType} + Payment ID: ${payment._id}`,
      successUrl: `${frontendUrl}/payment-success?paymentId=${payment._id}`,
      cancelUrl: `${frontendUrl}/payment-cancel`,
      failureUrl: `${frontendUrl}/payment-failure`,
      metadata: {
        userId,
        kind: paymentKind,
        packageType,
        membershipId: membershipDoc?._id || null,
        paymentId: payment._id,
        pets: petIds,
        tagType: membership ? null : getTagTypeFromPackageType(packageType),
      },
      billingDetails,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.YOCO_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `${userId}-${Date.now()}`,
      }
    });

    const checkoutId =
      response?.data?.id || response?.data?.checkoutId || response?.data?.checkout_id || null;
    if (checkoutId) {
      await Payment.findByIdAndUpdate(payment._id, { yocoCheckoutId: checkoutId, updatedAt: new Date() });
    }

    // Return the checkout URL to redirect the user
    res.status(200).json({ checkout_url: response.data.redirectUrl, paymentId: payment._id });
  } catch (error) {
    console.error('Checkout creation error:', error?.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Checkout creation failed' });
  }
};



const confirmPayment = async (req, res) => {
  const { token, amountInCents, paymentId } = req.body;

  if (!token || !amountInCents || !paymentId) {
    return res.status(400).json({ success: false, message: 'Missing required payment fields' });
  }

  try {
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found' });
    if (payment.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized for this payment' });
    }

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
      // Update payment record
      const paymentUpdate = await Payment.findByIdAndUpdate(paymentId, {
        status: 'successful',
        yocoChargeId: response.data.id
      }, { new: true });

      if (!paymentUpdate) {
        console.error('Payment not found or failed to update:', paymentId);
        return res.status(404).json({ success: false, message: 'Payment record not found' });
      }

      if (payment.kind !== 'membership') {
        return res.status(400).json({ success: false, message: 'This endpoint only supports membership payments' });
      }

      const membership = payment.membership ? await Membership.findById(payment.membership) : null;
      if (!membership) return res.status(400).json({ success: false, message: 'Missing membership for this payment' });

      // Update pets with membership info and correct tagType casing
      const petUpdateResult = await Pet.updateMany(
        { _id: { $in: payment.petIds }, userId: payment.userId },
        {
          $set: {
            hasMembership: true,
            membership: membership._id,
            membershipStartDate: new Date(),
          }
        }
      );

      if (petUpdateResult.modifiedCount === 0) {
        console.warn('No pets were updated with membership info for user:', userId);
      }

      // Update user membership status
      const userUpdate = await User.findByIdAndUpdate(payment.userId, {
        membershipActive: true,
        membershipStartDate: new Date(),
      }, { new: true });

      if (!userUpdate) {
        console.warn('User not found or failed to update membership status:', userId);
      }

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
    if (!req.user?.isAdmin && payment.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Not authorized to view this payment" });
    }

    const user = await User.findById(payment.userId).select("name surname email");
    const pets = await Pet.find({ _id: { $in: payment.petIds } }).select("name breed species hasMembership");
    const membershipDoc = payment.membership ? await Membership.findById(payment.membership) : null;

    const isMembershipPayment = payment.kind === 'membership';
    const isActiveForPets = isMembershipPayment
      ? pets.length > 0 && pets.every((p) => p.hasMembership)
      : false;

    res.status(200).json({
      success: true,
      data: {
        user,
        pets,
        kind: payment.kind,
        membership: isMembershipPayment
          ? { name: membershipDoc?.name || "Subscription", active: isActiveForPets }
          : { name: "No subscription", active: false },
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
