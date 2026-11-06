import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prescriptionUploadDir = path.resolve(__dirname, '../../uploads/prescriptions');
const doctorUploadDir = path.resolve(__dirname, '../../uploads/doctors');

// Ensure directories exist
if (!fs.existsSync(prescriptionUploadDir)) {
  fs.mkdirSync(prescriptionUploadDir, { recursive: true });
}
if (!fs.existsSync(doctorUploadDir)) {
  fs.mkdirSync(doctorUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, prescriptionUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHex = crypto.randomBytes(16).toString('hex');
    cb(null, `rx_${Date.now()}_${randomHex}${ext}`);
  },
});

const doctorStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, doctorUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHex = crypto.randomBytes(8).toString('hex');
    cb(null, `doc_${Date.now()}_${randomHex}${ext}`);
  },
});

const allowedMimes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

const photoAllowedMimes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];
const photoAllowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (allowedMimes.includes(mime) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type or extension. Only JPEG, PNG, WEBP, GIF images or PDF documents are permitted.'));
  }
};

const photoFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (photoAllowedMimes.includes(mime) && photoAllowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid photo format. Only JPG, JPEG, PNG, or WEBP images are permitted.'));
  }
};

export const prescriptionUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Megabytes
    files: 1,
  },
});

export const doctorPhotoUpload = multer({
  storage: doctorStorage,
  fileFilter: photoFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Megabytes
    files: 1,
  },
});

export default prescriptionUpload;
