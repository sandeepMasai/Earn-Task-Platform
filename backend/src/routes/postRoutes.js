const express = require('express');
const router = express.Router();
const { validateId } = require('../middleware/validateRequest');
router.param('id', validateId);
router.param('userId', validateId);
const {
  getFeed,
  getMyPosts,
  uploadPost,
  likePost,
  unlikePost,
  getPostById,
  addComment,
  getComments,
  deleteComment,
  updatePost,
  deletePost,
} = require('../controllers/postController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.get('/feed', protect, getFeed);
router.get('/me', protect, getMyPosts);
router.post('/', protect, upload.single('image'), require('../middleware/mediaReference')('post'), uploadPost);
router.post('/:id/like', protect, likePost);
router.post('/:id/unlike', protect, unlikePost);
router.get('/:id', protect, getPostById);
router.put('/:id', protect, updatePost);
router.delete('/:id', protect, deletePost);
router.post('/:id/comments', protect, addComment);
router.get('/:id/comments', protect, getComments);
router.delete('/:id/comments/:commentId', protect, deleteComment);

module.exports = router;
