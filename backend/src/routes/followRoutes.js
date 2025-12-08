const express = require('express');
const router = express.Router();
const {
  followUser,
  unfollowUser,
  getFollowStats,
} = require('../controllers/followController');
const { protect } = require('../middleware/auth');

router.post('/:userId', protect, followUser);
router.delete('/:userId', protect, unfollowUser);
router.get('/:userId', protect, getFollowStats);

module.exports = router;

