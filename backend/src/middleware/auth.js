const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      if (req.originalUrl?.includes('/media/')) {
        console.warn(`[MediaAuth] Unauthorized media request: no token provided for ${req.method} ${req.originalUrl}`);
      }
      return res.status(401).json({
        success: false,
        error: 'Not authorized, no token provided',
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (decoded.type !== 'access') return res.status(401).json({ success: false, error: 'Access token required' });
      req.user = await User.findById(decoded.userId).select('-password +tokenVersion');
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      if (!req.user.isActive) return res.status(403).json({ success: false, error: 'Account is blocked' });
      if ((decoded.tokenVersion ?? 0) !== (req.user.tokenVersion ?? 0)) return res.status(401).json({ success: false, error: 'Session expired; please log in again' });
      next();
    } catch (error) {
      if (req.originalUrl?.includes('/media/')) {
        console.warn(`[MediaAuth] Unauthorized media request: token verification failed for ${req.method} ${req.originalUrl} (${error.message})`);
      }
      return res.status(401).json({
        success: false,
        error: 'Not authorized, token failed',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

module.exports = { protect };

