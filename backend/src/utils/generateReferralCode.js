const generateReferralCode = (userId) => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const userIdPrefix = userId.toString().substring(0, 3).toUpperCase();
  return `${userIdPrefix}${random}`;
};

module.exports = generateReferralCode;

