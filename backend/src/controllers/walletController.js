const errorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const WithdrawalSettings = require('../models/WithdrawalSettings');
const { MIN_WITHDRAWAL_AMOUNT } = require('../constants');

// @desc    Get wallet balance
// @route   GET /api/wallet/balance
// @access  Private
exports.getBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: {
        balance: user.coins,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Get transactions
// @route   GET /api/wallet/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('task', 'title')
      .populate('withdrawal', 'amount status');

    res.json({
      success: true,
      data: transactions.map((t) => ({
        id: t._id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Request withdrawal
// @route   POST /api/wallet/withdraw
// @access  Private
exports.requestWithdrawal = async (req, res) => {
  try {
    const w = await require('../services/withdrawals').request(req.user._id, req.body);
    res.status(201).json({ success: true, data: { id: w._id, amount: w.amount, status: w.status, paymentMethod: w.paymentMethod, requestedAt: w.createdAt } });
  } catch (error) { return errorResponse(res, error); }
};

// @desc    Get withdrawal requests
// @route   GET /api/wallet/withdrawals
// @access  Private
exports.getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      data: withdrawals.map((w) => ({
        id: w._id,
        amount: w.amount,
        status: w.status,
        paymentMethod: w.paymentMethod,
        accountDetails: w.accountDetails,
        requestedAt: w.createdAt,
        processedAt: w.processedAt,
        rejectionReason: w.rejectionReason,
      })),
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Get withdrawal settings (public)
// @route   GET /api/wallet/withdrawal-settings
// @access  Public
exports.getWithdrawalSettings = async (req, res) => {
  try {
    const settings = await WithdrawalSettings.getSettings();
    res.json({
      success: true,
      data: {
        minimumWithdrawalAmount: settings.minimumWithdrawalAmount,
        withdrawalAmounts: settings.withdrawalAmounts,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

