const express = require('express');
const router = express.Router();
const {
  getStories,
  uploadStory,
  viewStory,
} = require('../controllers/storyController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', protect, getStories);
router.post('/', protect, upload.single('media'), uploadStory);
router.post('/:id/view', protect, viewStory);

module.exports = router;

