/* eslint-disable no-console */
const assert = require('assert');
const { buildSignatureString, md5Hex, verifyItnSignature, addMonthsClampedUtc } = require('../services/payfast.service');

try {
  const data = {
    merchant_id: '10000100',
    merchant_key: 'abc',
    amount_gross: '50.00',
    item_name: 'Monthly Subscription',
  };

  const signatureString = buildSignatureString({ data, passphrase: 'pass' });
  const signature = md5Hex(signatureString);
  const ok = verifyItnSignature({ data: { ...data, signature }, passphrase: 'pass' });
  assert.equal(ok.ok, true);

  const d = new Date(Date.UTC(2026, 0, 31)); // 2026-01-31
  const plus1 = addMonthsClampedUtc(d, 1);
  assert.equal(plus1.getUTCMonth(), 1); // Feb
  assert.equal(plus1.getUTCDate(), 28); // clamped

  console.log('payfast unit ok');
  process.exit(0);
} catch (err) {
  console.error('payfast unit failed:', err);
  process.exit(1);
}

