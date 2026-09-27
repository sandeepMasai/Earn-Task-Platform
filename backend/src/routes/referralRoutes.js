const express = require('express');
const router = express.Router();
const { validateId } = require('../middleware/validateRequest');
router.param('id', validateId);
router.param('userId', validateId);
const {
    getReferralStats,
    checkReferralCode,
} = require('../controllers/referralController');
const { protect } = require('../middleware/auth');

router.get('/stats', protect, getReferralStats);
router.get('/check/:code', checkReferralCode);

module.exports = router;

