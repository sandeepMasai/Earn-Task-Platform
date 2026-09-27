const helmet = require('helmet');
const { createHash } = require('node:crypto');
const Bucket = require('../models/RateLimitBucket');
const mongoose = require('mongoose');

function rateLimit({ prefix, limit, windowMs }) {
  return async (req, res, next) => {
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    // IPv6 clients share a /64 prefix, so rotating addresses cannot bypass limits.
    const key = require('express-rate-limit').ipKeyGenerator(req.ip, 64);
    const digest = createHash('sha256').update(key).digest('hex');
    const id = `${prefix}:${bucket}:${digest}`;
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ success: false, error: 'Service not ready' });
    try {
      let counter;
      const update = () => Bucket.findOneAndUpdate({ _id: id }, { $inc: { hits: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) } }, { upsert: true, new: true });
      try { counter = await update(); } catch (error) { if (error.code !== 11000) throw error; counter = await update(); }
      res.setHeader('RateLimit-Limit', String(limit));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - counter.hits)));
      if (counter.hits > limit) {
        res.setHeader('Retry-After', String(Math.ceil(((bucket + 1) * windowMs - now) / 1000)));
        return res.status(429).json({ success: false, error: 'Too many requests; retry later' });
      }
      next();
    } catch { return res.status(503).json({ success: false, error: 'Rate limit service unavailable' }); }
  };
}
module.exports = { helmet, rateLimit };
