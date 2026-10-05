const express = require('express');
const router = express.Router();
const { validateId } = require('../middleware/validateRequest');
router.param('id', validateId);
router.param('userId', validateId);
const {
  signup,
  login,
  getMe,
  getUserById,
  updateInstagramId,
  updateProfile,
  changePassword,
  logout,
  refreshToken,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { body, validationResult } = require('express-validator');

// Validation middleware
const signupValidation = [
  body('referralCode').optional().isString(),
  body('email').isString().bail().trim().toLowerCase().isEmail().withMessage('Please provide a valid email'),
  body('password').isString().bail().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').isString().bail().trim().notEmpty().withMessage('Name is required'),
  body('username').isString().bail().trim().toLowerCase().notEmpty().withMessage('Username is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      });
    }
    next();
  },
];

const loginValidation = [
  body('email').isString().bail().trim().toLowerCase().isEmail().withMessage('Please provide a valid email'),
  body('password').isString().bail().notEmpty().withMessage('Password is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      });
    }
    next();
  },
];

router.post('/signup', signupValidation, signup);
router.post('/login', loginValidation, login);
const reset = require('../controllers/passwordResetController');
const { rateLimit } = require('../middleware/security');
const { validate } = require('../middleware/validateRequest');
const resetEmail = () => body('email').isString().bail().trim().toLowerCase().isEmail().withMessage('Please provide a valid email');
router.post('/forgot-password', rateLimit({ prefix: 'password-reset-request', limit: 5, windowMs: 15 * 60000 }),
  resetEmail(), validate, reset.forgotPassword);
router.post('/verify-otp', rateLimit({ prefix: 'password-reset-verify', limit: 10, windowMs: 15 * 60000 }),
  resetEmail(),
  body('code').isString().bail().matches(/^\d{6}$/).withMessage('Enter the 6-digit code'),
  validate, reset.verifyOtp);
router.post('/reset-password', rateLimit({ prefix: 'password-reset-finish', limit: 10, windowMs: 15 * 60000 }),
  resetEmail(),
  body('resetToken').optional().isString().bail().trim().notEmpty(),
  body('code').optional().isString().bail().matches(/^\d{6}$/).withMessage('Enter the 6-digit code'),
  body('newPassword').isString().bail().isLength({ min: 6 }).bail()
    .custom(value => Buffer.byteLength(value, 'utf8') <= 72).withMessage('Password must be at least 6 characters and at most 72 bytes'),
  body().custom(reqBody => {
    if (!reqBody.resetToken && !reqBody.code) {
      throw new Error('Verification code or reset token is required');
    }
    return true;
  }),
  validate, reset.resetPassword);

router.get('/me', protect, getMe);
router.get('/user/:userId', protect, getUserById);
router.put('/instagram-id', protect, body('instagramId').isString().bail().trim().notEmpty(), require('../middleware/validateRequest').validate, updateInstagramId);
router.put('/profile', protect, upload.single('avatar'), require('../middleware/mediaReference')('avatar'),
  body('name').optional().isString().bail().trim().notEmpty(),
  body('email').optional().isString().bail().trim().toLowerCase().isEmail(),
  body('username').optional().isString().bail().trim().toLowerCase().notEmpty(),
  body('avatar').optional({ nullable: true }).isString(),
  require('../middleware/validateRequest').validate, updateProfile);
router.put('/change-password', protect, changePassword);
router.post('/logout', protect, logout);
router.post('/refresh', refreshToken);

module.exports = router;
