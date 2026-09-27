const jwt = require('jsonwebtoken');

function generateToken(userId, { type = 'access', expiresIn } = {}) {
  const secret = type === 'refresh' ? (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET) : process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be configured');
  return jwt.sign({ userId, type }, secret, {
    expiresIn: expiresIn || (type === 'refresh' ? process.env.JWT_REFRESH_EXPIRE || '7d' : process.env.JWT_EXPIRE || '1h'),
    algorithm: 'HS256',
  });
}
module.exports = generateToken;
