const mongoose = require('mongoose');

const User = require('../models/User');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const PayfastItnEvent = require('../models/PayfastItnEvent');
const PayfastCheckoutSession = require('../models/PayfastCheckoutSession');
const Pet = require('../models/Pet');

const {
  verifyItnSignature,
  parseZarToCents,
  addDays,
  addMonthsClampedUtc,
  getClientIp,
  isIpAllowed,
  validateWithPayfastServer,
  phpUrlEncode,
} = require('../services/payfast.service');

const getString = (obj, key) => {
  const val = obj ? obj[key] : undefined;
  if (Array.isArray(val)) return val.length ? String(val[0]) : '';
  if (val === null || val === undefined) return '';
  return String(val);
};

const parseDate = (value) => {
  const raw = (value || '').toString().trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const buildFormBody = (data) => {
  const keys = Object.keys(data || {}).sort();
  return keys.map((k) => `${phpUrlEncode(k)}=${phpUrlEncode(data[k])}`).join('&');
};

const extractUserIdFromReference = ({ m_payment_id, custom_str1 }) => {
  const candidate = (custom_str1 || '').toString().trim();
  if (candidate && mongoose.Types.ObjectId.isValid(candidate)) return candidate;

  const ref = (m_payment_id || '').toString();
  const match = ref.match(/[a-f0-9]{24}/i);
  if (match && mongoose.Types.ObjectId.isValid(match[0])) return match[0];
  return null;
};

const ensureMonthlyPlan = async ({ initialAmountZar, recurringAmountZar }) => {
  const key = 'MONTHLY';
  const existing = await SubscriptionPlan.findOne({ key }).lean();
  if (existing) return existing;

  const created = await SubscriptionPlan.create({
    key,
    name: 'Monthly Subscription',
    amountZar: recurringAmountZar,
    initialAmountZar,
    recurringAmountZar,
    currency: 'ZAR',
    interval: 'month',
    isActive: true,
  });

  return created.toObject();
};

exports.handlePayfastItn = async (req, res) => {
  const now = new Date();

  const merchantId = (process.env.PAYFAST_MERCHANT_ID || '').toString().trim();
  const merchantKey = (process.env.PAYFAST_MERCHANT_KEY || '').toString().trim();
  const passphrase = (process.env.PAYFAST_PASSPHRASE || '').toString();
  const mode = (process.env.PAYFAST_MODE || 'sandbox').toString();
  const ipAllowlist = (process.env.PAYFAST_IP_ALLOWLIST || '').toString();
  const shouldValidateServer = (process.env.PAYFAST_VALIDATE_WITH_SERVER || '').toString().toLowerCase() === 'true';

  const expectedRecurringPriceZar =
    Number(process.env.SUBSCRIPTION_RECURRING_PRICE_ZAR || process.env.SUBSCRIPTION_MONTHLY_PRICE_ZAR || 0);
  const expectedInitialPriceZar =
    Number(process.env.SUBSCRIPTION_INITIAL_PRICE_ZAR || expectedRecurringPriceZar || 0);
  const graceDays = Number(process.env.SUBSCRIPTION_GRACE_DAYS || 3);
  const amountToleranceCents = Number(process.env.PAYFAST_AMOUNT_TOLERANCE_CENTS || 5);

  if (!req.is('application/x-www-form-urlencoded')) {
    return res.status(400).json({ msg: 'Invalid content-type' });
  }

  if (!merchantId || !merchantKey) {
    console.error('[PayFast ITN] Missing PAYFAST_MERCHANT_ID/PAYFAST_MERCHANT_KEY env');
    return res.status(500).json({ msg: 'Server not configured' });
  }

  if (!Number.isFinite(expectedRecurringPriceZar) || expectedRecurringPriceZar <= 0) {
    console.error('[PayFast ITN] Missing/invalid SUBSCRIPTION_RECURRING_PRICE_ZAR (or SUBSCRIPTION_MONTHLY_PRICE_ZAR) env');
    return res.status(500).json({ msg: 'Server not configured' });
  }
  if (!Number.isFinite(expectedInitialPriceZar) || expectedInitialPriceZar <= 0) {
    console.error('[PayFast ITN] Missing/invalid SUBSCRIPTION_INITIAL_PRICE_ZAR env');
    return res.status(500).json({ msg: 'Server not configured' });
  }

  const body = req.body || {};

  const pf_payment_id = getString(body, 'pf_payment_id').trim();
  const m_payment_id = getString(body, 'm_payment_id').trim();
  const payment_status = getString(body, 'payment_status').trim();
  const signature = getString(body, 'signature').trim();
  const postedMerchantId = getString(body, 'merchant_id').trim();
  const postedMerchantKey = getString(body, 'merchant_key').trim();

  const clientIp = getClientIp(req);
  console.log('[PayFast ITN] received', {
    pf_payment_id,
    m_payment_id,
    payment_status,
    clientIp,
  });

  if (!pf_payment_id) return res.status(400).json({ msg: 'Missing pf_payment_id' });
  if (!signature) return res.status(400).json({ msg: 'Missing signature' });

  if (postedMerchantId !== merchantId) return res.status(403).json({ msg: 'Invalid merchant_id' });
  if (postedMerchantKey && postedMerchantKey !== merchantKey) return res.status(403).json({ msg: 'Invalid merchant_key' });

  if (!isIpAllowed({ ip: clientIp, allowlist: ipAllowlist })) {
    console.warn('[PayFast ITN] blocked ip', clientIp);
    return res.status(403).json({ msg: 'Forbidden' });
  }

  const sig = verifyItnSignature({ data: body, passphrase: passphrase || null });
  if (!sig.ok) {
    console.warn('[PayFast ITN] signature mismatch', {
      pf_payment_id,
      provided: sig.providedSignature,
      expected: sig.expectedSignature,
    });
    return res.status(403).json({ msg: 'Invalid signature' });
  }

  const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : (req.rawBody || '').toString();
  const validationBody = rawBody || buildFormBody(body);

  if (shouldValidateServer) {
    try {
      const validation = await validateWithPayfastServer({ mode, rawBody: validationBody });
      if (!validation.ok) {
        console.warn('[PayFast ITN] server validation failed', { pf_payment_id, status: validation.status, body: validation.body });
        return res.status(403).json({ msg: 'Server validation failed' });
      }
    } catch (err) {
      console.error('[PayFast ITN] server validation error', err?.message || err);
      return res.status(500).json({ msg: 'Validation error' });
    }
  }

  let itnEvent;
  try {
    itnEvent = await PayfastItnEvent.create({
      pf_payment_id,
      m_payment_id: m_payment_id || null,
      payment_status: payment_status || null,
      amount_gross: parseFloat(getString(body, 'amount_gross')) || null,
      amount_fee: parseFloat(getString(body, 'amount_fee')) || null,
      amount_net: parseFloat(getString(body, 'amount_net')) || null,
      item_name: getString(body, 'item_name') || null,
      name_first: getString(body, 'name_first') || null,
      name_last: getString(body, 'name_last') || null,
      email_address: getString(body, 'email_address') || null,
      token: getString(body, 'token') || null,
      billing_date: parseDate(getString(body, 'billing_date')),
      raw: body,
      rawBody: validationBody || null,
      receivedAt: now,
      processedOk: false,
      processingError: null,
    });
  } catch (err) {
    if (err?.code === 11000) {
      const existing = await PayfastItnEvent.findOne({ pf_payment_id }).lean();
      if (existing?.processingError === 'amount_mismatch' || existing?.processingError === 'merchant_mismatch') {
        return res.status(403).json({ msg: 'Invalid ITN' });
      }
      return res.status(200).send('OK');
    }
    console.error('[PayFast ITN] failed to persist event', err?.message || err);
    return res.status(500).json({ msg: 'Failed to persist ITN' });
  }

  try {
    const plan = await ensureMonthlyPlan({ initialAmountZar: expectedInitialPriceZar, recurringAmountZar: expectedRecurringPriceZar });
    const recurringExpectedCents = parseZarToCents(Number(plan.recurringAmountZar ?? plan.amountZar));
    const initialExpectedCents = parseZarToCents(Number(plan.initialAmountZar ?? plan.recurringAmountZar ?? plan.amountZar));
    const grossCents = parseZarToCents(getString(body, 'amount_gross'));

    const custom_str1 = getString(body, 'custom_str1').trim();
    const custom_str3 = getString(body, 'custom_str3').trim();
    const userIdFromRef = extractUserIdFromReference({ m_payment_id, custom_str1 });
    const email = getString(body, 'email_address').trim().toLowerCase();

    let user = null;
    if (userIdFromRef) user = await User.findById(userIdFromRef);
    if (!user && email) user = await User.findOne({ email });

    if (!user) {
      await PayfastItnEvent.updateOne(
        { _id: itnEvent._id },
        { $set: { processedOk: true, processingError: 'user_not_found' } }
      );
      console.error('[PayFast ITN] user not found', { pf_payment_id, m_payment_id, custom_str1, email: email || null });
      return res.status(200).send('OK');
    }

    const statusUpper = (payment_status || '').toString().trim().toUpperCase();
    const token = getString(body, 'token').trim() || null;
    const subscriptionId = getString(body, 'subscription_id').trim() || null;

    const billingDate = parseDate(getString(body, 'billing_date')) || now;

    if (statusUpper === 'COMPLETE') {
      const existing = await Subscription.findOne({ userId: user._id, planKey: plan.key });
      const isFirstPayment = !existing || !existing.setupFeePaidAt;

      if (isFirstPayment) {
        if (initialExpectedCents !== null && grossCents !== null && Math.abs(grossCents - initialExpectedCents) > amountToleranceCents) {
          await PayfastItnEvent.updateOne(
            { _id: itnEvent._id },
            { $set: { processedOk: false, processingError: 'amount_mismatch' } }
          );
          console.warn('[PayFast ITN] initial amount mismatch', { pf_payment_id, grossCents, expectedCents: initialExpectedCents });
          return res.status(403).json({ msg: 'Amount mismatch' });
        }
      } else {
        if (recurringExpectedCents !== null && grossCents !== null && Math.abs(grossCents - recurringExpectedCents) > amountToleranceCents) {
          await PayfastItnEvent.updateOne(
            { _id: itnEvent._id },
            { $set: { processedOk: false, processingError: 'amount_mismatch' } }
          );
          console.warn('[PayFast ITN] recurring amount mismatch', { pf_payment_id, grossCents, expectedCents: recurringExpectedCents });
          return res.status(403).json({ msg: 'Amount mismatch' });
        }
      }

      let periodStart = billingDate;
      if (!parseDate(getString(body, 'billing_date')) && existing?.currentPeriodEnd) {
        periodStart = existing.currentPeriodEnd;
      }
      const periodEnd = addMonthsClampedUtc(periodStart, 1);

      const nextBillingDate =
        parseDate(getString(body, 'next_billing_date')) ||
        parseDate(getString(body, 'next_payment_date')) ||
        null;

      const update = {
        status: 'active',
        payfastToken: token || existing?.payfastToken || null,
        payfastSubscriptionId: subscriptionId || existing?.payfastSubscriptionId || null,
        currentPeriodStart: periodStart,
        currentPeriodEnd: existing?.currentPeriodEnd && existing.currentPeriodEnd > periodEnd ? existing.currentPeriodEnd : periodEnd,
        lastPaymentAt: billingDate,
        nextBillingDate: nextBillingDate || existing?.nextBillingDate || null,
        pastDueAt: null,
        gracePeriodEndsAt: null,
      };

      if (!existing) {
        update.startDate = billingDate;
      } else if (!existing.startDate) {
        update.startDate = billingDate;
      }
      if (isFirstPayment) {
        update.setupFeePaidAt = billingDate;
        update.setupFeeAmountZar = Number(plan.initialAmountZar ?? null);
      }

      await Subscription.findOneAndUpdate(
        { userId: user._id, planKey: plan.key },
        { $set: update, $setOnInsert: { userId: user._id, planKey: plan.key } },
        { upsert: true, new: true, runValidators: true }
      );

      // If this ITN relates to a specific checkout session, apply pet updates / create petDraft.
      if (custom_str3) {
        const session = await PayfastCheckoutSession.findOne({ token: custom_str3, userId: user._id }).lean();
        if (session?.context) {
          const petIds = Array.isArray(session.context.petIds) ? session.context.petIds.filter(Boolean) : [];
          const petDraft = session.context.petDraft || null;

          if (petIds.length && isFirstPayment) {
            await Pet.updateMany(
              { _id: { $in: petIds }, userId: user._id },
              { $set: { hasMembership: true, membershipStartDate: billingDate } }
            );
          }

          if (isFirstPayment && petDraft?.name && petDraft?.species && petDraft?.breed) {
            const age = Number(petDraft.age);
            const genderRaw = (petDraft.gender || 'Other').toString();
            const gender = ['Male', 'Female', 'Other'].includes(genderRaw) ? genderRaw : 'Other';
            const sizeRaw = (petDraft.size || '').toString().trim().toLowerCase();
            const size = ['small', 'medium', 'large'].includes(sizeRaw) ? sizeRaw : null;

            if (Number.isFinite(age) && age >= 0) {
              await Pet.create({
                name: String(petDraft.name).trim(),
                species: String(petDraft.species).trim(),
                breed: String(petDraft.breed).trim(),
                age,
                gender,
                size,
                spayedNeutered: !!petDraft.spayedNeutered,
                photoUrl: petDraft.photoUrl || null,
                userId: user._id,
                hasMembership: true,
                membershipStartDate: billingDate,
              });
            } else {
              console.warn('[PayFast ITN] petDraft skipped due to invalid age', { pf_payment_id });
            }
          }
        }

        await PayfastCheckoutSession.deleteOne({ token: custom_str3, userId: user._id });
      }

      // Keep existing user-level membership flags in sync for the current app UX.
      const hasActivePet = await Pet.exists({ userId: user._id, hasMembership: true });
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            membershipActive: !!hasActivePet,
            membershipStartDate: hasActivePet ? (user?.membershipStartDate || billingDate) : null,
          },
        }
      );

      await PayfastItnEvent.updateOne(
        { _id: itnEvent._id },
        { $set: { processedOk: true, processingError: null } }
      );

      return res.status(200).send('OK');
    }

    if (statusUpper === 'FAILED' || statusUpper === 'REVERSED') {
      await Subscription.findOneAndUpdate(
        { userId: user._id, planKey: plan.key },
        {
          $set: {
            status: 'past_due',
            pastDueAt: now,
            gracePeriodEndsAt: addDays(now, graceDays),
          },
          $setOnInsert: { userId: user._id, planKey: plan.key, startDate: null },
        },
        { upsert: true, new: true }
      );
    } else if (statusUpper === 'CANCELLED') {
      await Subscription.findOneAndUpdate(
        { userId: user._id, planKey: plan.key },
        {
          $set: {
            status: 'cancelled',
            cancelAtPeriodEnd: true,
          },
          $setOnInsert: { userId: user._id, planKey: plan.key, startDate: null },
        },
        { upsert: true, new: true }
      );
    }

    await PayfastItnEvent.updateOne(
      { _id: itnEvent._id },
      { $set: { processedOk: true, processingError: null } }
    );

    return res.status(200).send('OK');
  } catch (err) {
    console.error('[PayFast ITN] processing error', err?.message || err);
    await PayfastItnEvent.updateOne(
      { _id: itnEvent._id },
      { $set: { processedOk: false, processingError: (err?.message || 'processing_failed').toString() } }
    );
    return res.status(500).json({ msg: 'Processing failed' });
  }
};
