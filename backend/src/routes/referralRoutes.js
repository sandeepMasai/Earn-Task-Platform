const express = require('express');
const router = express.Router();
const {
    getReferralStats,
    checkReferralCode,
} = require('../controllers/referralController');
const { protect } = require('../middleware/auth');

router.get('/stats', protect, getReferralStats);
router.get('/check/:code', checkReferralCode);

module.exports = router;

