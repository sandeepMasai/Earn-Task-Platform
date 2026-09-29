const express = require('express');
const router = express.Router();
const { validateId } = require('../middleware/validateRequest');
router.param('id', validateId);
router.param('userId', validateId);
const {
  getStories,
  uploadStory,
  viewStory,
} = require('../controllers/storyController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.get('/', protect, getStories);
router.post('/', protect, upload.single('media'), require('../middleware/mediaReference')('story'), uploadStory);
router.post('/:id/view', protect, viewStory);

module.exports = router;
