const express = require('express');
const router = express.Router();
const {
  getBalance,
  getTransactions,
  requestWithdrawal,
  getWithdrawals,
  getWithdrawalSettings,
} = require('../controllers/walletController');
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');

const withdrawalValidation = [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('paymentMethod').notEmpty().withMessage('Payment method is required'),
  body('accountDetails').notEmpty().withMessage('Account details are required'),
];

router.get('/balance', protect, getBalance);
router.get('/transactions', protect, getTransactions);
router.post('/withdraw', protect, withdrawalValidation, requestWithdrawal);
router.get('/withdrawals', protect, getWithdrawals);
router.get('/withdrawal-settings', getWithdrawalSettings);

module.exports = router;

