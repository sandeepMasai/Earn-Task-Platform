const express = require('express');
const router = express.Router();
const {
  getTasks,
  getTaskById,
  completeTask,
  verifyInstagramFollow,
  verifyYouTubeSubscribe,
} = require('../controllers/taskController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getTasks);
router.get('/:id', protect, getTaskById);
router.post('/:id/complete', protect, completeTask);
router.post('/verify/instagram-follow', protect, verifyInstagramFollow);
router.post('/verify/youtube-subscribe', protect, verifyYouTubeSubscribe);

module.exports = router;

