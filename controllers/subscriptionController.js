const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const PayfastCheckoutSession = require('../models/PayfastCheckoutSession');

const crypto = require('crypto');
const { buildSignatureString, md5Hex, getPayfastProcessUrl, formatZarAmount } = require('../services/payfast.service');

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

const getBackendBaseUrl = () => {
  const fromEnv = (process.env.BACKEND_URL || '').toString().trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  return 'http://localhost:5001';
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

exports.getMySubscription = async (req, res) => {
  try {
    const userId = req.userId;
    const subscriptions = await Subscription.find({ userId }).sort({ createdAt: -1 }).lean();
    const plans = await SubscriptionPlan.find({ isActive: true }).lean();

    return res.status(200).json({
      plans,
      subscriptions,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ msg: 'Failed to fetch subscription' });
  }
};

exports.createMySubscriptionCheckout = async (req, res) => {
  try {
    const merchantId = (process.env.PAYFAST_MERCHANT_ID || '').toString().trim();
    const merchantKey = (process.env.PAYFAST_MERCHANT_KEY || '').toString().trim();
    const passphrase = (process.env.PAYFAST_PASSPHRASE || '').toString();
    const mode = (process.env.PAYFAST_MODE || 'sandbox').toString();

    if (!merchantId || !merchantKey) {
      return res.status(500).json({ msg: 'Server not configured for PayFast' });
    }

    const userId = req.userId;
    const planKey = ((req.body?.planKey || 'MONTHLY').toString().trim().toUpperCase()) || 'MONTHLY';
    const petIds = Array.isArray(req.body?.petIds) ? req.body.petIds.filter(Boolean) : [];
    const petDraft = req.body?.petDraft || null;

    let plan = await SubscriptionPlan.findOne({ key: planKey }).lean();
    if (!plan) {
      const recurringAmountZar =
        Number(process.env.SUBSCRIPTION_RECURRING_PRICE_ZAR || process.env.SUBSCRIPTION_MONTHLY_PRICE_ZAR || 0);
      const initialAmountZar =
        Number(process.env.SUBSCRIPTION_INITIAL_PRICE_ZAR || recurringAmountZar || 0);

      if (!Number.isFinite(recurringAmountZar) || recurringAmountZar <= 0) {
        return res.status(500).json({ msg: 'Missing/invalid SUBSCRIPTION_RECURRING_PRICE_ZAR (or SUBSCRIPTION_MONTHLY_PRICE_ZAR)' });
      }
      if (!Number.isFinite(initialAmountZar) || initialAmountZar <= 0) {
        return res.status(500).json({ msg: 'Missing/invalid SUBSCRIPTION_INITIAL_PRICE_ZAR' });
      }

      plan = (await SubscriptionPlan.create({
        key: planKey,
        name: 'Monthly Subscription',
        amountZar: recurringAmountZar,
        initialAmountZar,
        recurringAmountZar,
        currency: 'ZAR',
        interval: 'month',
        isActive: true,
      })).toObject();
    }

    const recurringAmountZar = Number(plan.recurringAmountZar ?? plan.amountZar);
    const initialAmountZar = Number(plan.initialAmountZar ?? recurringAmountZar);

    const amount = formatZarAmount(initialAmountZar);
    const recurringAmount = formatZarAmount(recurringAmountZar);
    if (!amount || !recurringAmount) return res.status(500).json({ msg: 'Invalid plan amount' });

    await Subscription.findOneAndUpdate(
      { userId, planKey },
      { $set: { status: 'pending' }, $setOnInsert: { userId, planKey } },
      { upsert: true, new: true }
    );

    const frontendUrl = getFrontendUrl(req);
    const backendUrl = getBackendBaseUrl();
    const notifyUrl = `${backendUrl}/api/payfast/itn`;
    const returnUrl = `${frontendUrl}/subscription/success`;
    const cancelUrl = `${frontendUrl}/subscription/cancel`;

    const m_payment_id = `sub_${planKey}_${userId}_${Date.now()}`;
    const token = crypto.randomBytes(24).toString('hex');
    const data = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      m_payment_id,
      amount,
      item_name: plan.name || 'Monthly Subscription',
      custom_str1: String(userId),
      custom_str2: planKey,
      custom_str3: token,
      subscription_type: '1',
      recurring_amount: recurringAmount,
      frequency: '3',
      cycles: '0',
    };

    const signatureString = buildSignatureString({ data, passphrase: passphrase || null });
    data.signature = md5Hex(signatureString);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const actionUrl = getPayfastProcessUrl(mode);

    await PayfastCheckoutSession.create({
      token,
      userId,
      planKey,
      actionUrl,
      fields: data,
      context: { petIds, petDraft },
      expiresAt,
    });

    return res.status(200).json({
      provider: 'payfast',
      checkout_url: `${backendUrl}/api/subscriptions/checkout/${token}`,
      actionUrl,
      fields: data,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('[subscriptions/checkout] failed', err?.message || err);
    return res.status(500).json({ msg: 'Failed to create checkout' });
  }
};

exports.renderCheckoutPage = async (req, res) => {
  try {
    const token = (req.params?.token || '').toString().trim();
    if (!token) return res.status(400).send('Missing token');

    const session = await PayfastCheckoutSession.findOne({ token }).lean();
    if (!session) return res.status(404).send('Not found');
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      return res.status(410).send('Expired');
    }

    const actionUrl = session.actionUrl;
    const fields = session.fields || {};

    const inputs = Object.keys(fields)
      .map((k) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(fields[k])}">`)
      .join('');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting to PayFast…</title>
  </head>
  <body>
    <p>Redirecting to PayFast…</p>
    <form id="pf" method="post" action="${escapeHtml(actionUrl)}">
      ${inputs}
      <noscript><button type="submit">Continue</button></noscript>
    </form>
    <script>document.getElementById('pf').submit();</script>
  </body>
</html>`);
  } catch (err) {
    return res.status(500).send('Server error');
  }
};

exports.cancelMySubscription = async (req, res) => {
  try {
    const userId = req.userId;
    const subscription = await Subscription.findOne({ userId, planKey: 'MONTHLY' });
    if (!subscription) return res.status(404).json({ msg: 'No subscription found' });

    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    return res.status(200).json({ msg: 'Cancel requested', subscription });
  } catch (err) {
    return res.status(500).json({ msg: 'Failed to cancel subscription' });
  }
};
