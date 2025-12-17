const jwt = require('jsonwebtoken');

const generateToken = (userId, options = {}) => {
  const {
    expiresIn = process.env.JWT_EXPIRE || '1h',
    secret = process.env.JWT_SECRET || 'your-secret-key',
  } = options;

  return jwt.sign({ userId }, secret, {
    expiresIn,
  });
};

module.exports = generateToken;

