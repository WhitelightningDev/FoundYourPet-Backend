const express = require('express');
const router = express.Router();

const payfastController = require('../controllers/payfast.controller');
const { createSimpleRateLimiter } = require('../middleware/simpleRateLimit');
const { getClientIp, isIpAllowed } = require('../services/payfast.service');

const itnSizeGuard = (req, res, next) => {
  const len = Number(req.headers['content-length'] || 0);
  if (len && len > 50 * 1024) return res.status(413).json({ msg: 'Payload too large' });
  return next();
};

const itnRateLimiter = createSimpleRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => {
    const allowlist = (process.env.PAYFAST_IP_ALLOWLIST || '').toString();
    if (!allowlist) return false;
    const ip = getClientIp(req);
    return isIpAllowed({ ip, allowlist });
  },
});

router.post('/itn', itnSizeGuard, itnRateLimiter, payfastController.handlePayfastItn);

module.exports = router;

