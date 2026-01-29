const defaultKeyGenerator = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const createSimpleRateLimiter = ({ windowMs, max, keyGenerator = defaultKeyGenerator, skip = null }) => {
  const hits = new Map();

  return (req, res, next) => {
    try {
      if (typeof skip === 'function' && skip(req)) return next();

      const key = keyGenerator(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      const existing = hits.get(key);
      if (!existing) {
        hits.set(key, { count: 1, firstHitAt: now });
        return next();
      }

      if (existing.firstHitAt < windowStart) {
        hits.set(key, { count: 1, firstHitAt: now });
        return next();
      }

      existing.count += 1;
      if (existing.count > max) {
        return res.status(429).json({ msg: 'Too many requests' });
      }

      return next();
    } catch (err) {
      return next();
    }
  };
};

module.exports = { createSimpleRateLimiter };

