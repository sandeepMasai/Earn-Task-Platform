const mongoose = require('mongoose');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');
const WithdrawalSettings = require('../models/WithdrawalSettings');
const fail = require('../utils/httpError');

exports.request = async (userId, { amount, paymentMethod, accountDetails }) => {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0 || !Withdrawal.schema.path('paymentMethod').enumValues.includes(paymentMethod) || typeof accountDetails !== 'string' || !accountDetails.trim()) throw fail(400, 'Valid amount, payment method and account details are required');
  const settings = await WithdrawalSettings.getSettings();
  if (amount < settings.minimumWithdrawalAmount) throw fail(400, `Minimum withdrawal amount is ${settings.minimumWithdrawalAmount} coins`);
  return mongoose.connection.transaction(async session => {
    const user = await User.findOneAndUpdate({ _id: userId, isActive: true, coins: { $gte: amount } }, { $inc: { coins: -amount, totalWithdrawn: amount } }, { session, new: true });
    if (!user) throw fail(400, 'Insufficient balance');
    const [withdrawal] = await Withdrawal.create([{ user: userId, amount, paymentMethod, accountDetails: accountDetails.trim() }], { session });
    await Transaction.create([{ user: userId, type: 'withdrawn', amount, description: `Withdrawal request - ${paymentMethod}`, withdrawal: withdrawal._id }], { session });
    return withdrawal;
  });
};

exports.review = (id, status, rejectionReason) => mongoose.connection.transaction(async session => {
  const withdrawal = await Withdrawal.findById(id).session(session);
  if (!withdrawal) throw fail(404, 'Withdrawal request not found');
  const transitions = { pending: ['approved', 'rejected'], approved: ['completed', 'rejected'], completed: [], rejected: [] };
  if (!transitions[withdrawal.status].includes(status)) throw fail(400, 'Invalid withdrawal status transition');
  // Funds were already reserved when the request was created.
  if (status === 'rejected') {
    const user = await User.findByIdAndUpdate(withdrawal.user, { $inc: { coins: withdrawal.amount, totalWithdrawn: -withdrawal.amount } }, { session });
    if (!user) throw fail(404, 'User not found');
    await Transaction.create([{ user: withdrawal.user, type: 'refund', amount: withdrawal.amount, description: 'Withdrawal rejected; coins refunded', withdrawal: withdrawal._id }], { session });
  }
  withdrawal.status = status;
  withdrawal.processedAt = new Date();
  withdrawal.rejectionReason = status === 'rejected' ? rejectionReason || 'Withdrawal rejected' : null;
  await withdrawal.save({ session });
  return Withdrawal.findById(id).populate('user', 'name email username').session(session);
});
