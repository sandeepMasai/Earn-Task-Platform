const express = require('express');
const router = express.Router();
const {
  registerAsCreator,
  getCreatorDashboard,
  requestCoins,
  getCoinRequests,
  createTask,
  getCreatorRequestHistory,
  getTaskSubmissions,
  getTaskSubmissionById,
  approveTaskSubmission,
  rejectTaskSubmission,
} = require('../controllers/creatorController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Creator registration
router.post('/register', protect, registerAsCreator);

// Creator dashboard
router.get('/dashboard', protect, getCreatorDashboard);

// Coin requests
router.post('/request-coins', protect, upload.single('paymentProof'), requestCoins);
router.get('/coin-requests', protect, getCoinRequests);

// Creator task creation
router.post('/tasks', protect, createTask);

// Creator request history
router.get('/request-history', protect, getCreatorRequestHistory);

// Creator task submission review
router.get('/task-submissions', protect, getTaskSubmissions);
router.get('/task-submissions/:id', protect, getTaskSubmissionById);
router.put('/task-submissions/:id/approve', protect, approveTaskSubmission);
router.put('/task-submissions/:id/reject', protect, rejectTaskSubmission);

module.exports = router;

