const multer = require('multer');
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('./error.middleware');

// Configure AWS S3
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// File filter function to validate file types
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    video: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
    document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'],
    all: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.mkv', '.webm', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt']
  };

  // Get file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const fileType = req.fileType || 'all';

  if (allowedFileTypes[fileType].includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Invalid file type. Only ${allowedFileTypes[fileType].join(', ')} are allowed.`,
        400
      ),
      false
    );
  }
};

// Configure multer storage for S3
const s3Storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_BUCKET_NAME,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const fileType = req.fileType || 'all';
    const folder = req.uploadFolder || 'uploads';
    const fileName = `${folder}/${fileType}/${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, fileName);
  }
});

// Configure local storage for development
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fileType = req.fileType || 'all';
    const folder = req.uploadFolder || 'uploads';
    const dest = `public/${folder}/${fileType}`;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const fileName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, fileName);
  }
});

// Choose storage based on environment
const storage = process.env.NODE_ENV === 'production' ? s3Storage : localStorage;

// Create multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max file size
  }
});

/**
 * Middleware to handle single file upload
 * @param {String} fieldName - Form field name
 * @param {String} fileType - Type of file (image, video, document, all)
 * @param {String} folder - Folder to upload to
 */
exports.uploadSingleFile = (fieldName, fileType = 'all', folder = 'uploads') => {
  return (req, res, next) => {
    req.fileType = fileType;
    req.uploadFolder = folder;
    
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('File too large. Maximum size is 100MB.', 400));
        }
        return next(new AppError(`Multer upload error: ${err.message}`, 400));
      } else if (err) {
        return next(err);
      }
      next();
    });
  };
};

/**
 * Middleware to handle multiple file uploads
 * @param {String} fieldName - Form field name
 * @param {Number} maxCount - Maximum number of files
 * @param {String} fileType - Type of file (image, video, document, all)
 * @param {String} folder - Folder to upload to
 */
exports.uploadMultipleFiles = (fieldName, maxCount = 5, fileType = 'all', folder = 'uploads') => {
  return (req, res, next) => {
    req.fileType = fileType;
    req.uploadFolder = folder;
    
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('File too large. Maximum size is 100MB.', 400));
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new AppError(`Too many files. Maximum is ${maxCount}.`, 400));
        }
        return next(new AppError(`Multer upload error: ${err.message}`, 400));
      } else if (err) {
        return next(err);
      }
      next();
    });
  };
};

/**
 * Middleware to handle video upload for returns
 */
exports.uploadReturnVideo = exports.uploadSingleFile('video', 'video', 'returns');

/**
 * Middleware to handle product images upload
 */
exports.uploadProductImages = exports.uploadMultipleFiles('images', 10, 'image', 'products');

/**
 * Middleware to handle KYC document uploads
 */
exports.uploadKycDocument = exports.uploadSingleFile('document', 'document', 'kyc');

/**
 * Delete file from S3
 * @param {String} fileUrl - URL of file to delete
 */
exports.deleteFileFromS3 = async (fileUrl) => {
  try {
    if (!fileUrl) return;
    
    // Extract key from URL
    const key = fileUrl.split(`${process.env.AWS_BUCKET_NAME}/`)[1];
    
    if (!key) return;
    
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    };
    
    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    return false;
  }
};