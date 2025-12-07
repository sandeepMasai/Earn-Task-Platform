const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  getMe,
  updateInstagramId,
  logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Validation middleware
const signupValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').notEmpty().withMessage('Name is required'),
  body('username').notEmpty().withMessage('Username is required'),
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
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
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
router.put('/instagram-id', protect, updateInstagramId);
router.post('/logout', protect, logout);

module.exports = router;

