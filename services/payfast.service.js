const crypto = require('crypto');
const axios = require('axios');

const phpUrlEncode = (value) => {
  const str = value === null || value === undefined ? '' : String(value);

  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7E');
};

const buildSignatureString = ({ data, passphrase = null }) => {
  const keys = Object.keys(data || {}).filter((k) => k !== 'signature').sort();
  const parts = [];

  for (const key of keys) {
    const value = data[key];
    if (value === undefined) continue;
    parts.push(`${phpUrlEncode(key)}=${phpUrlEncode(value)}`);
  }

  if (passphrase) {
    parts.push(`passphrase=${phpUrlEncode(passphrase)}`);
  }

  return parts.join('&');
};

const md5Hex = (input) => crypto.createHash('md5').update(input, 'utf8').digest('hex');

const verifyItnSignature = ({ data, passphrase = null }) => {
  const provided = (data?.signature || '').toString().trim();
  const signatureString = buildSignatureString({ data, passphrase });
  const expected = md5Hex(signatureString);

  return {
    ok: !!provided && expected.toLowerCase() === provided.toLowerCase(),
    providedSignature: provided,
    expectedSignature: expected,
    signatureString,
  };
};

const parseZarToCents = (amount) => {
  if (amount === null || amount === undefined) return null;
  const raw = String(amount).trim();
  if (!raw) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) return null;

  const negative = raw.startsWith('-');
  const normalized = negative ? raw.slice(1) : raw;
  const [rands, cents = ''] = normalized.split('.');
  const cents2 = (cents + '00').slice(0, 2);

  const value = (Number(rands) * 100) + Number(cents2);
  return negative ? -value : value;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
};

const daysInMonthUtc = (year, monthIndex0) => new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();

const addMonthsClampedUtc = (date, months) => {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  const targetMonth = month + Number(months || 0);
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const dim = daysInMonthUtc(targetYear, normalizedMonth);
  const clampedDay = Math.min(day, dim);

  const out = new Date(Date.UTC(
    targetYear,
    normalizedMonth,
    1,
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds()
  ));
  out.setUTCDate(clampedDay);
  return out;
};

const getClientIp = (req) => {
  const xff = req.headers['x-forwarded-for'];
  const ipFromXff = Array.isArray(xff) ? xff[0] : (xff || '').toString();
  const first = ipFromXff.split(',')[0]?.trim();
  const ip = first || req.ip || req.socket?.remoteAddress || '';
  return ip.replace(/^::ffff:/, '');
};

const ipv4ToInt = (ip) => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3];
};

const ipInCidr = (ip, cidr) => {
  const [range, bitsStr] = String(cidr).split('/');
  const bits = Number(bitsStr);
  if (!range || Number.isNaN(bits) || bits < 0 || bits > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;

  const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
};

const parseIpAllowlist = (raw) => {
  const list = (raw || '').toString().split(',').map((s) => s.trim()).filter(Boolean);
  return list;
};

const isIpAllowed = ({ ip, allowlist }) => {
  const list = Array.isArray(allowlist) ? allowlist : parseIpAllowlist(allowlist);
  if (!list.length) return true;

  for (const entry of list) {
    if (entry.includes('/')) {
      if (ipInCidr(ip, entry)) return true;
      continue;
    }
    if (entry === ip) return true;
  }
  return false;
};

const getPayfastValidateUrl = (mode) => {
  const normalized = (mode || 'sandbox').toString().trim().toLowerCase();
  return normalized === 'live'
    ? 'https://www.payfast.co.za/eng/query/validate'
    : 'https://sandbox.payfast.co.za/eng/query/validate';
};

const getPayfastProcessUrl = (mode) => {
  const normalized = (mode || 'sandbox').toString().trim().toLowerCase();
  return normalized === 'live'
    ? 'https://www.payfast.co.za/eng/process'
    : 'https://sandbox.payfast.co.za/eng/process';
};

const formatZarAmount = (amountZar) => {
  const n = Number(amountZar);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
};

const validateWithPayfastServer = async ({ mode, rawBody }) => {
  const url = getPayfastValidateUrl(mode);
  const response = await axios.post(url, rawBody, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    validateStatus: () => true,
  });

  const body = (response?.data || '').toString().trim();
  return { ok: body === 'VALID', status: response.status, body };
};

module.exports = {
  phpUrlEncode,
  buildSignatureString,
  verifyItnSignature,
  md5Hex,
  parseZarToCents,
  addDays,
  addMonthsClampedUtc,
  getClientIp,
  parseIpAllowlist,
  isIpAllowed,
  getPayfastProcessUrl,
  formatZarAmount,
  validateWithPayfastServer,
};
