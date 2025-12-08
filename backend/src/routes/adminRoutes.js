const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllPayments,
  updatePaymentStatus,
  getAllUsers,
  getUserDetails,
  blockUser,
  deleteUser,
  downloadPayments,
  getCoinConfigs,
  updateCoinConfig,
  updateCoinConfigs,
  getTaskSubmissions,
  getTaskSubmissionById,
  approveTaskSubmission,
  rejectTaskSubmission,
} = require('../controllers/adminController');
const { admin } = require('../middleware/admin');

// Dashboard
router.get('/dashboard', admin, getDashboardStats);

// Payments
router.get('/payments', admin, getAllPayments);
router.put('/payments/:id/status', admin, updatePaymentStatus);
router.get('/payments/download', admin, downloadPayments);

// Users
router.get('/users', admin, getAllUsers);
router.get('/users/:id', admin, getUserDetails);
router.put('/users/:id/block', admin, blockUser);
router.delete('/users/:id', admin, deleteUser);

// Coin Management
router.get('/coins', admin, getCoinConfigs);
router.put('/coins', admin, updateCoinConfigs);
router.put('/coins/:key', admin, updateCoinConfig);

// Task Submissions Review
router.get('/task-submissions', admin, getTaskSubmissions);
router.get('/task-submissions/:id', admin, getTaskSubmissionById);
router.put('/task-submissions/:id/approve', admin, approveTaskSubmission);
router.put('/task-submissions/:id/reject', admin, rejectTaskSubmission);

module.exports = router;

