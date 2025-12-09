const express = require('express');
const router = express.Router();
const {
  registerAsCreator,
  getCreatorDashboard,
  requestCoins,
  getCoinRequests,
  createTask,
  getCreatorTasks,
  updateCreatorTask,
  deleteCreatorTask,
  getCreatorRequestHistory,
  getTaskSubmissions,
  getTaskSubmissionById,
  approveTaskSubmission,
  rejectTaskSubmission,
} = require('../controllers/creatorController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// Creator registration
router.post('/register', protect, registerAsCreator);

// Creator dashboard
router.get('/dashboard', protect, getCreatorDashboard);

// Coin requests
router.post('/request-coins', protect, upload.single('paymentProof'), requestCoins);
router.get('/coin-requests', protect, getCoinRequests);

// Creator task management
router.post('/tasks', protect, createTask);
router.get('/tasks', protect, getCreatorTasks);
router.put('/tasks/:id', protect, updateCreatorTask);
router.delete('/tasks/:id', protect, deleteCreatorTask);

// Creator request history
router.get('/request-history', protect, getCreatorRequestHistory);

// Creator task submission review
router.get('/task-submissions', protect, getTaskSubmissions);
router.get('/task-submissions/:id', protect, getTaskSubmissionById);
router.put('/task-submissions/:id/approve', protect, approveTaskSubmission);
router.put('/task-submissions/:id/reject', protect, rejectTaskSubmission);

module.exports = router;

