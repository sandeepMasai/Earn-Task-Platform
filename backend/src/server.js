const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Log file size limits on startup
console.log('\n📋 File Upload Configuration:');
console.log(`   MAX_FILE_SIZE: ${process.env.MAX_FILE_SIZE || 'not set (default: 900MB)'}`);
console.log(`   MAX_VIDEO_SIZE: ${process.env.MAX_VIDEO_SIZE || 'not set (default: 900MB)'}`);
console.log('');

// Import routes
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const walletRoutes = require('./routes/walletRoutes');
const postRoutes = require('./routes/postRoutes');
const referralRoutes = require('./routes/referralRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminTaskRoutes = require('./routes/adminTaskRoutes');
const creatorRoutes = require('./routes/creatorRoutes');
const storyRoutes = require('./routes/storyRoutes');
const followRoutes = require('./routes/followRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins (for React Native)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json({ limit: '1000mb' })); // Increased for large file uploads
app.use(express.urlencoded({ extended: true, limit: '1000mb' })); // Increased for large file uploads

// Log all requests
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`, req.body || req.query || '');
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Database connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/earn-task-platform')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/tasks', adminTaskRoutes);
app.use('/api/creator', creatorRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/follow', followRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Earn Task Platform API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Handle Multer errors specifically
  if (err.code === 'LIMIT_FILE_SIZE') {
    // Check if it's a video upload (from field name or content type)
    const isVideo = err.field === 'video' || err.field === 'media' ||
      (req.file && req.file.mimetype && req.file.mimetype.startsWith('video/'));

    const maxSizeMB = isVideo
      ? (process.env.MAX_VIDEO_SIZE
        ? Math.round(parseInt(process.env.MAX_VIDEO_SIZE) / (1024 * 1024))
        : 900)
      : (process.env.MAX_FILE_SIZE
        ? Math.round(parseInt(process.env.MAX_FILE_SIZE) / (1024 * 1024))
        : 900);

    const fileType = isVideo ? 'video' : 'file';
    return res.status(413).json({
      success: false,
      error: `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} too large. Maximum ${fileType} size is ${maxSizeMB}MB`,
    });
  }

  // Handle other Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      // Check if it's a video upload
      const isVideo = err.field === 'video' || err.field === 'media' ||
        (req.file && req.file.mimetype && req.file.mimetype.startsWith('video/'));

      const maxSizeMB = isVideo
        ? (process.env.MAX_VIDEO_SIZE
          ? Math.round(parseInt(process.env.MAX_VIDEO_SIZE) / (1024 * 1024))
          : 900)
        : (process.env.MAX_FILE_SIZE
          ? Math.round(parseInt(process.env.MAX_FILE_SIZE) / (1024 * 1024))
          : 900);

      const fileType = isVideo ? 'video' : 'file';
      return res.status(413).json({
        success: false,
        error: `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} too large. Maximum ${fileType} size is ${maxSizeMB}MB`,
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`📱 API: http://localhost:${PORT}/api`);
  console.log(`📱 API (Network): http://${getLocalIP()}:${PORT}/api`);
});

// Get local IP address for network access
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

module.exports = app;

