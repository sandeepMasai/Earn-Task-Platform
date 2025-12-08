const express = require('express');
const router = express.Router();
const {
  getTasks,
  getTaskById,
  completeTask,
  verifyInstagramFollow,
  verifyYouTubeSubscribe,
  submitTaskProof,
} = require('../controllers/taskController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', protect, getTasks);
router.get('/:id', protect, getTaskById);
router.post('/:id/complete', protect, completeTask);
router.post('/:id/submit-proof', protect, upload.single('proofImage'), submitTaskProof);
router.post('/verify/instagram-follow', protect, verifyInstagramFollow);
router.post('/verify/youtube-subscribe', protect, verifyYouTubeSubscribe);

module.exports = router;

