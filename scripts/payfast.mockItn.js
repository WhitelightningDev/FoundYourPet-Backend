/* eslint-disable no-console */
const axios = require('axios');
const { buildSignatureString, md5Hex } = require('../services/payfast.service');

const post = async () => {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5001';
  const notifyUrl = `${baseUrl.replace(/\\/+$/, '')}/api/payfast/itn`;

  const merchant_id = process.env.PAYFAST_MERCHANT_ID || '10000100';
  const merchant_key = process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a';
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';

  const userId = process.env.TEST_USER_ID || '507f1f77bcf86cd799439011';
  const price =
    process.env.MOCK_ITN_AMOUNT_GROSS ||
    process.env.SUBSCRIPTION_INITIAL_PRICE_ZAR ||
    process.env.SUBSCRIPTION_RECURRING_PRICE_ZAR ||
    process.env.SUBSCRIPTION_MONTHLY_PRICE_ZAR ||
    '70.00';

  const payload = {
    merchant_id,
    merchant_key,
    m_payment_id: `sub_MONTHLY_${userId}_${Date.now()}`,
    pf_payment_id: `PF_${Date.now()}`,
    payment_status: 'COMPLETE',
    item_name: 'Monthly Subscription',
    amount_gross: price,
    amount_fee: '0.00',
    amount_net: price,
    name_first: 'Test',
    name_last: 'User',
    email_address: 'test@example.com',
    custom_str1: userId,
    billing_date: new Date().toISOString(),
  };

  const signatureString = buildSignatureString({ data: payload, passphrase: passphrase || null });
  payload.signature = md5Hex(signatureString);

  const body = new URLSearchParams(payload).toString();
  const res = await axios.post(notifyUrl, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    validateStatus: () => true,
  });

  console.log('POST', notifyUrl, '->', res.status, res.data?.toString?.() || res.data);
};

post().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
