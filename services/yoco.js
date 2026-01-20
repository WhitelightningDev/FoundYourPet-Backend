const axios = require('axios');

const getYocoSecretKey = () => {
  const key = (process.env.YOCO_SECRET_KEY || '').toString().trim();
  if (!key) return null;
  if (!key.startsWith('sk_')) return null;
  return key;
};

const normalizeStatus = (value) => (value || '').toString().trim().toLowerCase();

const interpretCheckout = (checkout) => {
  const statusRaw =
    checkout?.status ??
    checkout?.state ??
    checkout?.paymentStatus ??
    checkout?.payment_status ??
    null;

  const status = normalizeStatus(statusRaw);

  const isSuccessful = ['completed', 'successful', 'succeeded', 'paid'].includes(status) || status.startsWith('complete');
  const isFailed = ['failed', 'error', 'declined'].includes(status);
  const isCanceled = ['cancelled', 'canceled', 'cancel'].includes(status);

  const possibleChargeId =
    checkout?.chargeId ??
    checkout?.charge_id ??
    checkout?.payment?.id ??
    checkout?.payment?.chargeId ??
    checkout?.payment?.charge_id ??
    null;

  return { status, isSuccessful, isFailed, isCanceled, yocoChargeId: possibleChargeId || null };
};

const fetchCheckout = async (checkoutId) => {
  const key = getYocoSecretKey();
  if (!key) return { ok: false, reason: 'missing_or_invalid_secret_key' };
  if (!checkoutId) return { ok: false, reason: 'missing_checkout_id' };

  try {
    const response = await axios.get(`https://payments.yoco.com/api/checkouts/${checkoutId}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    return { ok: true, checkout: response.data, interpretation: interpretCheckout(response.data) };
  } catch (err) {
    const status = err?.response?.status || null;
    return { ok: false, reason: 'provider_error', status, details: err?.response?.data || err?.message };
  }
};

module.exports = { fetchCheckout, interpretCheckout };

