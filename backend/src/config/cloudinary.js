const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Check if Cloudinary is configured
const useCloudinary = () => {
  return !!(process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET);
};

// Verify Cloudinary configuration
if (useCloudinary()) {
  console.log('☁️  Cloudinary configured successfully');
  console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
} else {
  console.log('⚠️  Cloudinary not configured - using local storage');
  console.log('   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env');
}

// Create storage for different file types
const createStorage = (folder) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      let resourceType = 'auto'; // Cloudinary auto-detects type
      let folderPath = folder || 'earn-task-platform';

      // Determine resource type based on mimetype
      if (file.mimetype.startsWith('image/')) {
        resourceType = 'image';
        folderPath = `${folderPath}/images`;
      } else if (file.mimetype.startsWith('video/')) {
        resourceType = 'video';
        folderPath = `${folderPath}/videos`;
      } else {
        resourceType = 'raw'; // For documents
        folderPath = `${folderPath}/documents`;
      }

      return {
        folder: folderPath,
        resource_type: resourceType,
        allowed_formats: resourceType === 'image'
          ? ['jpg', 'jpeg', 'png', 'gif', 'webp']
          : resourceType === 'video'
            ? ['mp4', 'mov', 'avi', 'webm', 'mkv']
            : ['pdf', 'doc', 'docx', 'txt'],
        transformation: resourceType === 'image'
          ? [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }]
          : resourceType === 'video'
            ? [{ quality: 'auto', fetch_format: 'auto' }]
            : [],
        public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      };
    },
  });
};

// Helper function to delete file from Cloudinary
const deleteFromCloudinary = async (url) => {
  if (!url || !useCloudinary()) {
    return false;
  }

  try {
    // Check if it's a Cloudinary URL
    if (!url.includes('cloudinary.com')) {
      return false; // Not a Cloudinary URL
    }

    // Extract public_id from Cloudinary URL
    // Cloudinary URLs format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{transformations}/{folder}/{public_id}.{format}
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');

    if (uploadIndex === -1) {
      return false; // Not a valid Cloudinary URL
    }

    // Get everything after 'upload' and before file extension
    const afterUpload = urlParts.slice(uploadIndex + 1);
    const lastPart = afterUpload[afterUpload.length - 1];
    const publicIdWithExt = lastPart.split('.')[0];

    // Reconstruct public_id with folder path if present
    let publicId = '';
    if (afterUpload.length > 1) {
      // Include folder path in public_id
      const folderParts = afterUpload.slice(0, -1);
      publicId = folderParts.join('/') + '/' + publicIdWithExt;
    } else {
      publicId = publicIdWithExt;
    }

    // Determine resource type from URL path
    let resourceType = 'image';
    if (url.includes('/video/')) {
      resourceType = 'video';
    } else if (url.includes('/raw/')) {
      resourceType = 'raw';
    }

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return false;
  }
};

module.exports = {
  cloudinary,
  createStorage,
  deleteFromCloudinary,
  useCloudinary,
};
