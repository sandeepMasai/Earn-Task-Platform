const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createStorage } = require('../config/cloudinary');

// Check if Cloudinary is configured
const isCloudinaryEnabled = process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

let storage;

if (isCloudinaryEnabled) {
  // Use Cloudinary storage for videos
  storage = createStorage('earn-task-platform/videos');
  console.log('☁️  Using Cloudinary for video uploads');
} else {
  // Fallback to local storage
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
  });
  console.log('📁 Using local storage for video uploads');
}

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed'), false);
  }
};

// Calculate max video size - prioritize environment variable, default to 900MB
// Handle both numeric values and values with "mb" suffix
let envMaxVideoSize = null;
if (process.env.MAX_VIDEO_SIZE) {
  const envValue = process.env.MAX_VIDEO_SIZE.toString().toLowerCase().trim();
  if (envValue.endsWith('mb')) {
    const mbValue = parseInt(envValue.replace('mb', ''));
    envMaxVideoSize = mbValue * 1024 * 1024;
  } else {
    envMaxVideoSize = parseInt(envValue);
  }
}
const maxVideoSize = envMaxVideoSize || 900 * 1024 * 1024; // 900MB default
const maxVideoSizeMB = Math.round(maxVideoSize / (1024 * 1024));

console.log(`🎥 Video upload limit configuration:`);
console.log(`   - MAX_VIDEO_SIZE env: ${process.env.MAX_VIDEO_SIZE || 'not set'}`);
console.log(`   - Calculated limit: ${maxVideoSizeMB}MB (${maxVideoSize} bytes)`);

const uploadVideo = multer({
  storage: storage,
  limits: {
    fileSize: maxVideoSize,
  },
  fileFilter: fileFilter,
});

// Helper function to get video URL (Cloudinary or local)
const getVideoUrl = (file) => {
  if (isCloudinaryEnabled && file && file.path) {
    // Cloudinary returns the URL in file.path
    return file.path;
  } else if (file && file.filename) {
    // Local storage - return relative path
    return `/uploads/${file.filename}`;
  }
  return null;
};

// Export useCloudinary function
const useCloudinary = () => {
  return !!(process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET);
};

module.exports = { uploadVideo, getVideoUrl, useCloudinary };

