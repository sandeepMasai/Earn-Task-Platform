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
router.get('/me', protect, getMe);
router.get('/user/:userId', protect, getUserById);
router.put('/instagram-id', protect, body('instagramId').isString().bail().trim().notEmpty(), require('../middleware/validateRequest').validate, updateInstagramId);
router.put('/profile', protect, upload.single('avatar'),
  body('name').optional().isString().bail().trim().notEmpty(),
  body('email').optional().isString().bail().trim().toLowerCase().isEmail(),
  body('username').optional().isString().bail().trim().toLowerCase().notEmpty(),
  body('avatar').optional({ nullable: true }).isString(),
  require('../middleware/validateRequest').validate, updateProfile);
router.put('/change-password', protect, changePassword);
router.post('/logout', protect, logout);
router.post('/refresh', refreshToken);

module.exports = router;

