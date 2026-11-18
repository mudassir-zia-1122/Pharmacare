import multer from 'multer';
import path from 'path';

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 Megabytes

export const PRESCRIPTION_ALLOWED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

export const PRESCRIPTION_ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.pdf',
];

export const DOCTOR_PHOTO_ALLOWED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export const DOCTOR_PHOTO_ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
];

// Use memoryStorage so storage.service.js can validate magic bytes and stream directly
// to Cloudinary (doctor photos), Cloudflare R2 (private prescriptions), or local dev disk.
const memoryStorage = multer.memoryStorage();

const prescriptionFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (PRESCRIPTION_ALLOWED_MIMES.includes(mime) && PRESCRIPTION_ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type or extension. Only JPEG, PNG, WEBP, GIF images or PDF documents are permitted.'
      )
    );
  }
};

const doctorPhotoFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (DOCTOR_PHOTO_ALLOWED_MIMES.includes(mime) && DOCTOR_PHOTO_ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid photo format. Only JPG, JPEG, PNG, or WEBP images are permitted.'));
  }
};

export const prescriptionUpload = multer({
  storage: memoryStorage,
  fileFilter: prescriptionFileFilter,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 1,
  },
});

export const doctorPhotoUpload = multer({
  storage: memoryStorage,
  fileFilter: doctorPhotoFilter,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 1,
  },
});

export default prescriptionUpload;
