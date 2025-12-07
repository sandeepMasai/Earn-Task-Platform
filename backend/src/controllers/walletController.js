const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Request withdrawal
// @route   POST /api/wallet/withdraw
// @access  Private
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, paymentMethod, accountDetails } = req.body;

    if (!amount || !paymentMethod || !accountDetails) {
      return res.status(400).json({
        success: false,
        error: 'Please provide amount, payment method, and account details',
      });
    }

    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Minimum withdrawal amount is ${MIN_WITHDRAWAL_AMOUNT} coins`,
      });
    }

    const user = await User.findById(req.user._id);

    if (user.coins < amount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance',
      });
    }

    // Deduct coins
    user.coins -= amount;
    user.totalWithdrawn += amount;
    await user.save();

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      user: req.user._id,
      amount,
      paymentMethod,
      accountDetails,
      status: 'pending',
    });

    // Create transaction
    await Transaction.create({
      user: req.user._id,
      type: 'withdrawn',
      amount,
      description: `Withdrawal request - ${paymentMethod}`,
      withdrawal: withdrawal._id,
    });

    res.status(201).json({
      success: true,
      data: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        paymentMethod: withdrawal.paymentMethod,
        requestedAt: withdrawal.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

