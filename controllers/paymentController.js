const axios = require('axios');
const Payment = require('../models/Payment');
const Pet = require('../models/Pet');
const Membership = require('../models/Membership');
const User = require('../models/User');
const { finalizeSuccessfulPayment } = require('../services/paymentFinalizer');
const { fetchCheckout } = require('../services/yoco');

const getFrontendUrl = (req) => {
  const fromEnv = process.env.FRONTEND_URL;
  const fromOrigin = req?.headers?.origin;
  const fromReferer = req?.headers?.referer;

  let candidate = fromEnv || fromOrigin;
  if (!candidate && fromReferer) {
    try {
      candidate = new URL(fromReferer).origin;
    } catch {
      // ignore
    }
  }

  const fallback = 'http://localhost:3000';
  const trimmed = (candidate || '').toString().trim().replace(/\/+$/, '');
  if (!trimmed) return fallback;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return fallback;
  }
};

const normalizeBool = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = (value || '').toString().trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return false;
};

const getSubscriptionPriceForSize = (sizeInput) => {
  const size = (sizeInput || '').toString().trim().toLowerCase();
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
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = req.userId;
  const { petIds, amountInCents, packageType, billingDetails } = req.body;
  const membership = normalizeBool(req.body.membership);
  const petDraft = req.body.petDraft || null;

  if (!userId || !petIds || !amountInCents || !packageType || !billingDetails) {
    return res.status(400).json({ success: false, message: "Missing required fields", requestId });
  }

  const frontendUrl = getFrontendUrl(req);
  const yocoSecretKey = process.env.YOCO_SECRET_KEY;
  if (!yocoSecretKey) {
    return res.status(500).json({
      success: false,
      message: "Server misconfiguration: YOCO_SECRET_KEY is not set",
      requestId,
    });
  }
  if (String(yocoSecretKey).trim().startsWith('pk_')) {
    return res.status(500).json({
      success: false,
      message: "Server misconfiguration: YOCO_SECRET_KEY is set to a public key (pk_...). Use your secret key (sk_...) on the backend.",
      requestId,
    });
  }
  if (!String(yocoSecretKey).trim().startsWith('sk_')) {
    return res.status(500).json({
      success: false,
      message: "Server misconfiguration: YOCO_SECRET_KEY must be a secret key (sk_...).",
      requestId,
    });
  }

  try {
    console.log(`[createCheckoutSession:${requestId}] start`, {
      userId,
      membership,
      petIdsCount: Array.isArray(petIds) ? petIds.length : null,
      hasPetDraft: !!petDraft,
      frontendUrl,
      packageType,
    });

    const normalizedPetIds = Array.isArray(petIds) ? petIds : [];
    const isNewPetSubscription = membership && normalizedPetIds.length === 0 && !!petDraft;

    const parseFiniteNumberOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const parseDateOrNull = (value) => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    if (!isNewPetSubscription && normalizedPetIds.length === 0) {
      return res.status(400).json({ success: false, message: "petIds must be a non-empty array" });
    }

    const pets = normalizedPetIds.length
      ? await Pet.find({ _id: { $in: normalizedPetIds }, userId })
      : [];
    if (normalizedPetIds.length && pets.length !== normalizedPetIds.length) {
      return res.status(400).json({ success: false, message: "One or more pets were not found for this user" });
    }

    let paymentKind = membership ? 'membership' : 'tag';
    let finalAmountInCents = Number(amountInCents);
    let membershipDoc = null;

    if (membership) {
      if (!isNewPetSubscription && normalizedPetIds.length !== 1) {
        return res.status(400).json({ success: false, message: "Membership checkout supports exactly one pet" });
      }

      const sizeSource = isNewPetSubscription ? petDraft?.size : pets[0]?.size;
      const monthlyPrice = getSubscriptionPriceForSize(sizeSource);
      if (!monthlyPrice) {
        return res.status(400).json({
          success: false,
          message: "Pet size must be set to Small / Medium / Large before subscribing",
        });
      }

      if (!isNewPetSubscription) {
        const pet = pets[0];
        if (pet.hasMembership) {
          return res.status(409).json({ success: false, message: "This pet already has an active subscription" });
        }
      }

      const normalizedSize = (sizeSource || '').toString().toLowerCase();
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

    const sanitizedPetDraft = isNewPetSubscription
      ? {
          name: petDraft?.name ? String(petDraft.name).trim() : null,
          species: petDraft?.species ? String(petDraft.species).trim() : null,
          breed: petDraft?.breed ? String(petDraft.breed).trim() : null,
          age: parseFiniteNumberOrNull(petDraft?.age),
          gender: petDraft?.gender ? String(petDraft.gender).trim() : null,
          color: petDraft?.color ? String(petDraft.color).trim() : null,
          size: petDraft?.size ? String(petDraft.size).trim().toLowerCase() : null,
          dateOfBirth: parseDateOrNull(petDraft?.dateOfBirth),
          spayedNeutered: normalizeBool(petDraft?.spayedNeutered),
          trainingLevel: petDraft?.trainingLevel ? String(petDraft.trainingLevel).trim() : null,
          weight: parseFiniteNumberOrNull(petDraft?.weight),
          microchipNumber: petDraft?.microchipNumber ? String(petDraft.microchipNumber).trim() : null,
          photoUrl: petDraft?.photoUrl ? String(petDraft.photoUrl).trim() : null,
        }
      : null;

    if (isNewPetSubscription) {
      const missingDraftFields = [];
      if (!sanitizedPetDraft?.name) missingDraftFields.push('name');
      if (!sanitizedPetDraft?.species) missingDraftFields.push('species');
      if (!sanitizedPetDraft?.breed) missingDraftFields.push('breed');
      if (!Number.isFinite(sanitizedPetDraft?.age)) missingDraftFields.push('age');
      if (!sanitizedPetDraft?.gender) missingDraftFields.push('gender');
      if (!sanitizedPetDraft?.size) missingDraftFields.push('size');

      if (missingDraftFields.length) {
        return res.status(400).json({
          success: false,
          message: `Missing/invalid petDraft fields: ${missingDraftFields.join(', ')}`,
        });
      }
    }

    const user = await User.findById(userId).select('name surname email contact address');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', requestId });
    }

    const shippingSnapshot = {
      name: user.name || null,
      surname: user.surname || null,
      email: user.email || null,
      contact: user.contact || null,
      address: user.address
        ? {
            street: user.address.street || null,
            city: user.address.city || null,
            province: user.address.province || null,
            postalCode: user.address.postalCode || null,
            country: user.address.country || null,
          }
        : null,
    };

    let payment = await Payment.create({
      userId,
      petIds: normalizedPetIds,
      kind: paymentKind,
      amountInCents: finalAmountInCents,
      membership: membershipDoc?._id || null,
      petDraft: sanitizedPetDraft,
      packageType,
      tagType: paymentKind === 'tag' ? getTagTypeFromPackageType(packageType) : null,
      shipping: shippingSnapshot,
    });

    // 3. Create the Yoco Checkout session
    let response;
    try {
      response = await axios.post('https://payments.yoco.com/api/checkouts', {
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
          pets: normalizedPetIds,
          tagType: membership ? null : getTagTypeFromPackageType(packageType),
        },
        billingDetails,
      }, {
        headers: {
          'Authorization': `Bearer ${yocoSecretKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `${userId}-${Date.now()}`,
        }
      });
    } catch (yocoErr) {
      await Payment.findByIdAndUpdate(payment._id, { status: 'failed', updatedAt: new Date() });
      const status = yocoErr?.response?.status;
      const providerMessage = yocoErr?.response?.data || yocoErr?.message;
      return res.status(502).json({
        success: false,
        message: "Checkout creation failed",
        provider: "yoco",
        status,
        details: providerMessage,
        requestId,
      });
    }

    if (!response?.data?.redirectUrl) {
      await Payment.findByIdAndUpdate(payment._id, { status: 'failed', updatedAt: new Date() });
      return res.status(502).json({
        success: false,
        message: "Checkout creation failed",
        provider: "yoco",
        details: "Missing redirectUrl in Yoco response",
        requestId,
      });
    }

    const checkoutId =
      response?.data?.id || response?.data?.checkoutId || response?.data?.checkout_id || null;
    if (checkoutId) {
      await Payment.findByIdAndUpdate(payment._id, { yocoCheckoutId: checkoutId, updatedAt: new Date() });
    }

    // Return the checkout URL to redirect the user
    res.status(200).json({ checkout_url: response.data.redirectUrl, paymentId: payment._id });
  } catch (error) {
    console.error(`[createCheckoutSession:${requestId}] error`, error?.response?.data || error);
    res.status(500).json({
      success: false,
      message: 'Checkout creation failed',
      requestId,
      errorName: error?.name || 'Error',
      details: error?.response?.data || error?.message,
    });
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
      if (payment.kind !== 'membership') {
        return res.status(400).json({ success: false, message: 'This endpoint only supports membership payments' });
      }

      const result = await finalizeSuccessfulPayment({
        paymentId,
        yocoChargeId: response.data.id,
        metadata: {
          paymentId,
          kind: 'membership',
          membershipId: payment.membership ? payment.membership.toString() : null,
          pets: Array.isArray(payment.petIds) ? payment.petIds.map((id) => id.toString()) : [],
          packageType: payment.packageType,
        },
        now: new Date(),
      });

      if (!result.ok) {
        console.error('Payment finalization failed:', result.reason);
        return res.status(500).json({ success: false, message: 'Payment processing failed' });
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
    let payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
    if (!req.user?.isAdmin && payment.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Not authorized to view this payment" });
    }

    if (payment.status === 'pending' && payment.yocoCheckoutId) {
      const checkoutResult = await fetchCheckout(payment.yocoCheckoutId);
      if (checkoutResult.ok) {
        const { checkout, interpretation } = checkoutResult;
        const metadata = checkout?.metadata || null;

        const metadataPaymentId = metadata?.paymentId ? metadata.paymentId.toString() : null;
        if (metadataPaymentId && metadataPaymentId !== payment._id.toString()) {
          console.warn('[getPaymentDetails] paymentId mismatch between DB and provider metadata', {
            paymentId: payment._id.toString(),
            metadataPaymentId,
          });
        } else if (interpretation?.isSuccessful) {
          await finalizeSuccessfulPayment({
            paymentId: payment._id,
            yocoChargeId: interpretation?.yocoChargeId || null,
            metadata,
            now: new Date(),
          });
          payment = await Payment.findById(paymentId);
        } else if ((interpretation?.isFailed || interpretation?.isCanceled) && !payment.processedAt) {
          await Payment.findByIdAndUpdate(payment._id, { $set: { status: 'failed', updatedAt: new Date() } });
          payment = await Payment.findById(paymentId);
        }
      }
    }

    const user = await User.findById(payment.userId).select("name surname email");
    const pets = await Pet.find({ _id: { $in: payment.petIds } }).select("name breed species hasMembership");
    const membershipDoc = payment.membership ? await Membership.findById(payment.membership) : null;

    const paymentKind = payment.kind || (payment.membership ? 'membership' : 'tag');
    const isMembershipPayment = paymentKind === 'membership';
    const isActiveForPets = isMembershipPayment
      ? pets.length > 0 && pets.every((p) => p.hasMembership)
      : false;

    res.status(200).json({
      success: true,
      data: {
        user,
        pets,
        kind: paymentKind,
        petDraft: isMembershipPayment && payment.petDraft?.name
          ? {
              name: payment.petDraft.name,
              species: payment.petDraft.species,
              breed: payment.petDraft.breed,
              age: payment.petDraft.age,
              gender: payment.petDraft.gender,
              size: payment.petDraft.size,
              photoUrl: payment.petDraft.photoUrl,
            }
          : null,
        membership: isMembershipPayment
          ? { name: membershipDoc?.name || "Subscription", active: isActiveForPets }
          : { name: "No subscription", active: false },
        amountPaid: (payment.amountInCents / 100).toFixed(2),
        packageType: payment.packageType,
        status: payment.status,
        yoco: {
          checkoutId: payment.yocoCheckoutId || null,
          chargeId: payment.yocoChargeId || null,
        },
      },
    });
  } catch (err) {
    console.error("Failed to retrieve payment details:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseClampedInt = (raw, { min, max, fallback }) => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

// Admin: list successful tag purchases for fulfillment
const getAdminTagOrders = async (req, res) => {
  try {
    const limit = parseClampedInt(req.query.limit, { min: 1, max: 100, fallback: 50 });
    const skip = parseClampedInt(req.query.skip, { min: 0, max: 1_000_000, fallback: 0 });
    const q = (req.query.q || '').toString().trim();
    const fulfillmentStatus = (req.query.fulfillmentStatus || req.query.fulfillment || '').toString().trim().toLowerCase();

    const allowedFulfillmentStatuses = new Set([
      'unfulfilled',
      'processing',
      'submitted',
      'shipped',
      'delivered',
      'cancelled',
    ]);

    if (fulfillmentStatus && !allowedFulfillmentStatuses.has(fulfillmentStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid fulfillmentStatus' });
    }

    const and = [{ kind: 'tag', status: 'successful' }];

    if (q) {
      const safe = escapeRegex(q);
      const regex = new RegExp(safe, 'i');
      and.push({
        $or: [
          { packageType: regex },
          { tagType: regex },
          { 'shipping.email': regex },
          { 'shipping.name': regex },
          { 'shipping.surname': regex },
          { 'shipping.contact': regex },
          { 'shipping.address.city': regex },
          { 'shipping.address.province': regex },
          { 'shipping.address.postalCode': regex },
        ],
      });
    }

    if (fulfillmentStatus) {
      if (fulfillmentStatus === 'unfulfilled') {
        and.push({
          $or: [
            { 'fulfillment.status': { $exists: false } },
            { 'fulfillment.status': null },
            { 'fulfillment.status': 'unfulfilled' },
          ],
        });
      } else {
        and.push({ 'fulfillment.status': fulfillmentStatus });
      }
    } else {
      and.push({
        $or: [
          { 'fulfillment.status': { $exists: false } },
          { 'fulfillment.status': null },
          { 'fulfillment.status': { $in: ['unfulfilled', 'processing', 'submitted'] } },
        ],
      });
    }

    const query = and.length === 1 ? and[0] : { $and: and };

    const [total, payments] = await Promise.all([
      Payment.countDocuments(query),
      Payment.find(query)
        .sort({ processedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name surname email contact address')
        .populate('petIds', 'name species breed')
        .lean(),
    ]);

    const orders = payments.map((payment) => {
      const pets = Array.isArray(payment.petIds)
        ? payment.petIds.map((pet) => ({
            _id: pet._id,
            name: pet.name || null,
            species: pet.species || null,
            breed: pet.breed || null,
          }))
        : [];

      const user = payment.userId
        ? {
            _id: payment.userId._id,
            name: payment.userId.name || null,
            surname: payment.userId.surname || null,
            email: payment.userId.email || null,
            contact: payment.userId.contact || null,
            address: payment.userId.address || null,
          }
        : null;

      const shipping = payment.shipping || (user ? { ...user, address: user.address } : null);

      return {
        paymentId: payment._id,
        purchasedAt: payment.processedAt || null,
        amountInCents: payment.amountInCents,
        currency: payment.currency || 'ZAR',
        amountPaid: (payment.amountInCents / 100).toFixed(2),
        packageType: payment.packageType || null,
        tagType: payment.tagType || getTagTypeFromPackageType(payment.packageType) || null,
        quantity: pets.length,
        pets,
        user,
        shipping,
        fulfillment: payment.fulfillment || null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        orders,
        page: { total, skip, limit, returned: orders.length },
      },
    });
  } catch (err) {
    console.error('Failed to list tag orders:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Admin: update fulfillment/tracking details for a tag order
const updateTagOrderFulfillment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const requestedStatus = req.body?.status ? String(req.body.status).trim().toLowerCase() : null;
    const notes = req.body?.notes !== undefined ? String(req.body.notes || '').trim() : undefined;
    const pudoShipmentId = req.body?.pudoShipmentId !== undefined ? String(req.body.pudoShipmentId || '').trim() : undefined;
    const pudoTrackingNumber =
      req.body?.pudoTrackingNumber !== undefined ? String(req.body.pudoTrackingNumber || '').trim() : undefined;
    const pudoStatus = req.body?.pudoStatus !== undefined ? String(req.body.pudoStatus || '').trim() : undefined;
    const pudoLabelUrl = req.body?.pudoLabelUrl !== undefined ? String(req.body.pudoLabelUrl || '').trim() : undefined;

    const allowedFulfillmentStatuses = new Set([
      'unfulfilled',
      'processing',
      'submitted',
      'shipped',
      'delivered',
      'cancelled',
    ]);

    if (requestedStatus && !allowedFulfillmentStatuses.has(requestedStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ success: false, message: 'Order not found' });
    if (payment.kind !== 'tag') return res.status(400).json({ success: false, message: 'Not a tag order' });
    if (payment.status !== 'successful') {
      return res.status(409).json({ success: false, message: 'Order is not a successful payment' });
    }

    const now = new Date();
    const set = {
      updatedAt: now,
      'fulfillment.updatedAt': now,
      'fulfillment.provider': 'pudo',
    };

    if (!payment.fulfillment?.createdAt) set['fulfillment.createdAt'] = now;

    if (requestedStatus) {
      set['fulfillment.status'] = requestedStatus;
      if (requestedStatus === 'submitted' && !payment.fulfillment?.submittedAt) set['fulfillment.submittedAt'] = now;
      if (requestedStatus === 'shipped' && !payment.fulfillment?.shippedAt) set['fulfillment.shippedAt'] = now;
      if (requestedStatus === 'delivered' && !payment.fulfillment?.deliveredAt) set['fulfillment.deliveredAt'] = now;
    }

    if (notes !== undefined) set['fulfillment.notes'] = notes || null;
    if (pudoShipmentId !== undefined) set['fulfillment.pudo.shipmentId'] = pudoShipmentId || null;
    if (pudoTrackingNumber !== undefined) set['fulfillment.pudo.trackingNumber'] = pudoTrackingNumber || null;
    if (pudoStatus !== undefined) set['fulfillment.pudo.status'] = pudoStatus || null;
    if (pudoLabelUrl !== undefined) set['fulfillment.pudo.labelUrl'] = pudoLabelUrl || null;

    await Payment.updateOne({ _id: paymentId }, { $set: set });

    const updated = await Payment.findById(paymentId)
      .populate('userId', 'name surname email contact address')
      .populate('petIds', 'name species breed')
      .lean();

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error('Failed to update fulfillment:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getPaymentDetails,
  createCheckoutSession,
  confirmPayment,
  getAdminTagOrders,
  updateTagOrderFulfillment,

};
