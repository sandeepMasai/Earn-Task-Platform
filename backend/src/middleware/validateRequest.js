const { validationResult } = require('express-validator');

exports.validateId = (req, res, next, value) => {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    return res.status(400).json({ success: false, error: 'Invalid resource ID' });
  }
  next();
};

exports.validateQuery = (req, res, next) => {
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value !== 'string') {
      return res.status(400).json({ success: false, error: `Invalid ${key}` });
    }
    if (['page', 'limit'].includes(key) && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || (key === 'limit' && Number(value) > 100))) {
      return res.status(400).json({ success: false, error: `Invalid ${key}` });
    }
    if (key === 'taskId' && !/^[a-f\d]{24}$/i.test(value)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID' });
    }
    if (['startDate', 'endDate'].includes(key) && !Number.isFinite(Date.parse(value))) {
      return res.status(400).json({ success: false, error: `Invalid ${key}` });
    }
  }
  next();
};

exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
  next();
};
