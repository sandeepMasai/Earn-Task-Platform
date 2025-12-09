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
  // Use Cloudinary storage
  storage = createStorage('earn-task-platform');
  console.log('☁️  Using Cloudinary for file uploads');
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
  console.log('📁 Using local storage for file uploads');
}

const fileFilter = (req, file, cb) => {
  // Allow images, videos, and documents
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('video/') ||
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'text/plain' ||
    file.mimetype === 'application/msword' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Only images, videos, PDFs, and documents are allowed'), false);
  }
};

// Calculate max file size - prioritize environment variable, default to 900MB
// Handle both numeric values and values with "mb" suffix
let envMaxSize = null;
if (process.env.MAX_FILE_SIZE) {
  const envValue = process.env.MAX_FILE_SIZE.toString().toLowerCase().trim();
  if (envValue.endsWith('mb')) {
    const mbValue = parseInt(envValue.replace('mb', ''));
    envMaxSize = mbValue * 1024 * 1024;
  } else {
    envMaxSize = parseInt(envValue);
  }
}
const maxFileSize = envMaxSize || 900 * 1024 * 1024; // 900MB default
const maxFileSizeMB = Math.round(maxFileSize / (1024 * 1024));

console.log(`📦 File upload limit configuration:`);
console.log(`   - MAX_FILE_SIZE env: ${process.env.MAX_FILE_SIZE || 'not set'}`);
console.log(`   - Calculated limit: ${maxFileSizeMB}MB (${maxFileSize} bytes)`);

const upload = multer({
  storage: storage,
  limits: {
    fileSize: maxFileSize,
  },
  fileFilter: fileFilter,
});

// Helper function to get file URL (Cloudinary or local)
const getFileUrl = (file) => {
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

module.exports = { upload, getFileUrl, useCloudinary };

