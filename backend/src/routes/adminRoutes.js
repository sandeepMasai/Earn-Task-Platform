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

module.exports = router;

