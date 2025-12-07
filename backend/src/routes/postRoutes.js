const express = require('express');
const router = express.Router();
const {
  getFeed,
  uploadPost,
  likePost,
  unlikePost,
  getPostById,
  addComment,
  getComments,
} = require('../controllers/postController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/feed', protect, getFeed);
router.post('/', protect, upload.single('image'), uploadPost);
router.post('/:id/like', protect, likePost);
router.post('/:id/unlike', protect, unlikePost);
router.get('/:id', protect, getPostById);
router.post('/:id/comments', protect, addComment);
router.get('/:id/comments', protect, getComments);

module.exports = router;

