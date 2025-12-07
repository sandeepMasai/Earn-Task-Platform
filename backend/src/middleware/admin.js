const { protect } = require('./auth');

const admin = async (req, res, next) => {
  // First check authentication
  protect(req, res, () => {
    // Then check if user is admin
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.',
      });
    }
  });
};

module.exports = { admin };

