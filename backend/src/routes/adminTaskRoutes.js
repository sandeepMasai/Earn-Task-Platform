const express = require('express');
const router = express.Router();
const {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTaskCompletions,
} = require('../controllers/adminTaskController');
const { protect } = require('../middleware/auth');
const { admin } = require('../middleware/admin');

// All routes require authentication and admin role
router.use(protect, admin);

// Create task
router.post('/', createTask);

// Get all tasks
router.get('/', getAllTasks);

// Get task completions
router.get('/:id/completions', getTaskCompletions);

// Get single task
router.get('/:id', getTaskById);

// Update task
router.put('/:id', updateTask);

// Delete task
router.delete('/:id', deleteTask);

module.exports = router;

