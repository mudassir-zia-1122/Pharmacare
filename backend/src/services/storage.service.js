import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  MAX_UPLOAD_SIZE_BYTES,
  PRESCRIPTION_ALLOWED_MIMES,
  PRESCRIPTION_ALLOWED_EXTENSIONS,
  DOCTOR_PHOTO_ALLOWED_MIMES,
  DOCTOR_PHOTO_ALLOWED_EXTENSIONS,
} from '../config/upload.js';
import { ApiError } from '../utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const LOCAL_DOCTORS_DIR = path.resolve(__dirname, '../../uploads/doctors');
export const LOCAL_PRESCRIPTIONS_DIR = path.resolve(__dirname, '../../uploads/prescriptions');
export const R2_KEY_PREFIX = 'r2://';
const MIN_SIGNED_URL_TTL = 30;
const MAX_SIGNED_URL_TTL = 300;
const DEFAULT_SIGNED_URL_TTL = 120;

const PLACEHOLDER_PATTERNS = [
  /^your_/i,
  /^replace_with_/i,
  /^<.*>$/,
  /^changeme$/i,
];

function isRealEnvValue(val) {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isCloudinaryConfigured(env = process.env) {
  return (
    isRealEnvValue(env.CLOUDINARY_CLOUD_NAME) &&
    isRealEnvValue(env.CLOUDINARY_API_KEY) &&
    isRealEnvValue(env.CLOUDINARY_API_SECRET)
  );
}

export function getR2Endpoint(env = process.env) {
  if (isRealEnvValue(env.R2_ENDPOINT)) {
    return env.R2_ENDPOINT.trim().replace(/\/+$/, '');
  }
  if (isRealEnvValue(env.R2_ACCOUNT_ID)) {
    return `https://${env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`;
  }
  return '';
}

export function isR2Configured(env = process.env) {
  return (
    Boolean(getR2Endpoint(env)) &&
    isRealEnvValue(env.R2_ACCESS_KEY_ID) &&
    isRealEnvValue(env.R2_SECRET_ACCESS_KEY) &&
    isRealEnvValue(env.R2_PRIVATE_BUCKET)
  );
}

/**
 * Returns sanitized storage configuration metadata (never exposes secrets).
 */
export function getStorageConfigStatus(env = process.env) {
  const cloudinaryReady = isCloudinaryConfigured(env);
  const r2Ready = isR2Configured(env);
  const isProd = env.NODE_ENV === 'production';
  const allowEphemeral = env.ALLOW_EPHEMERAL_UPLOADS === 'true';

  return {
    environment: env.NODE_ENV || 'development',
    cloudinaryConfigured: cloudinaryReady,
    r2Configured: r2Ready,
    doctorPhotoProvider: cloudinaryReady
      ? 'cloudinary'
      : isProd && !allowEphemeral
      ? 'unconfigured_blocked'
      : 'local_dev',
    prescriptionProvider: r2Ready
      ? 'cloudflare_r2'
      : isProd && !allowEphemeral
      ? 'unconfigured_blocked'
      : 'local_dev',
  };
}

/**
 * Verifies file magic bytes match the declared MIME type to block spoofed uploads.
 */
export function hasValidMagicBytes(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  const mime = (mimeType || '').toLowerCase();

  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mime === 'image/gif') {
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (mime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mime === 'application/pdf') {
    return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  return false;
}

/**
 * Validates file buffer, size, extension, MIME type, and magic bytes.
 */
export function validateUploadedFile(file, category = 'prescription') {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw ApiError.badRequest('A non-empty file upload is required.');
  }

  const size = typeof file.size === 'number' ? file.size : file.buffer.length;
  if (size > MAX_UPLOAD_SIZE_BYTES || file.buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    throw ApiError.badRequest('File exceeds the maximum permitted size of 5 MB.');
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isDoctorPhoto = category === 'doctor_photo';
  const allowedMimes = isDoctorPhoto ? DOCTOR_PHOTO_ALLOWED_MIMES : PRESCRIPTION_ALLOWED_MIMES;
  const allowedExts = isDoctorPhoto ? DOCTOR_PHOTO_ALLOWED_EXTENSIONS : PRESCRIPTION_ALLOWED_EXTENSIONS;

  if (!allowedMimes.includes(mime) || !allowedExts.includes(ext)) {
    throw ApiError.badRequest(
      isDoctorPhoto
        ? 'Invalid photo format. Only JPG, JPEG, PNG, or WEBP images are permitted.'
        : 'Invalid file type or extension. Only JPEG, PNG, WEBP, GIF images or PDF documents are permitted.'
    );
  }

  if (!hasValidMagicBytes(file.buffer, mime)) {
    throw ApiError.badRequest('Uploaded file signature does not match its declared file type.');
  }

  return { ext, mime, size: file.buffer.length };
}

function getConfiguredCloudinaryClient() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
    secure: true,
  });
  return cloudinary;
}

function createR2Client(env = process.env) {
  return new S3Client({
    region: 'auto',
    endpoint: getR2Endpoint(env),
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID.trim(),
      secretAccessKey: env.R2_SECRET_ACCESS_KEY.trim(),
    },
  });
}

function ensureLocalDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Uploads a public doctor profile photo / public medical image.
 * - Uses Cloudinary when configured.
 * - Uses local dev disk ONLY in non-production environments (or when ALLOW_EPHEMERAL_UPLOADS=true).
 * - Fails explicitly with 503 in production if Cloudinary is not configured.
 */
export async function uploadDoctorPhoto(file, options = {}) {
  const { ext, mime, size } = validateUploadedFile(file, 'doctor_photo');
  const env = options.env || process.env;
  const randomHex = crypto.randomBytes(8).toString('hex');
  const baseName = `doc_${Date.now()}_${randomHex}`;

  if (options.cloudinaryClient || isCloudinaryConfigured(env)) {
    const client = options.cloudinaryClient || getConfiguredCloudinaryClient();
    const folder = (env.CLOUDINARY_DOCTOR_FOLDER || 'pharmacare/doctors').trim();

    try {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = client.uploader.upload_stream(
          {
            folder,
            public_id: baseName,
            resource_type: 'image',
            overwrite: false,
            unique_filename: false,
          },
          (error, result) => {
            if (error) return reject(error);
            if (!result || !result.secure_url) {
              return reject(new Error('Cloudinary upload returned no secure URL.'));
            }
            return resolve(result);
          }
        );
        Readable.from(file.buffer).pipe(uploadStream);
      });

      return {
        url: uploadResult.secure_url,
        key: uploadResult.public_id,
        provider: 'cloudinary',
        mimeType: mime,
        size,
      };
    } catch (err) {
      throw new ApiError(502, `Failed to upload doctor photograph to cloud storage: ${err.message}`);
    }
  }

  if (env.NODE_ENV === 'production' && env.ALLOW_EPHEMERAL_UPLOADS !== 'true') {
    throw new ApiError(
      503,
      'Persistent cloud storage (Cloudinary) is not configured for doctor photos in production.'
    );
  }

  // Local development fallback (never deletes existing local files)
  ensureLocalDir(LOCAL_DOCTORS_DIR);
  const filename = `${baseName}${ext}`;
  const filePath = path.resolve(LOCAL_DOCTORS_DIR, filename);
  await fs.promises.writeFile(filePath, file.buffer);

  return {
    url: `/uploads/doctors/${filename}`,
    key: filename,
    provider: 'local',
    mimeType: mime,
    size,
  };
}

/**
 * Uploads a private prescription or sensitive medical document.
 * - Uses Cloudflare R2 private bucket when configured (NEVER public).
 * - Uses local dev disk ONLY in non-production environments (or when ALLOW_EPHEMERAL_UPLOADS=true).
 * - Fails explicitly with 503 in production if Cloudflare R2 is not configured.
 */
export async function uploadPrivatePrescription(file, options = {}) {
  const { ext, mime, size } = validateUploadedFile(file, 'prescription');
  const env = options.env || process.env;
  const randomHex = crypto.randomBytes(16).toString('hex');
  const filename = `rx_${Date.now()}_${randomHex}${ext}`;

  if (options.r2Client || isR2Configured(env)) {
    const client = options.r2Client || createR2Client(env);
    const bucket = (env.R2_PRIVATE_BUCKET || '').trim();
    const prefix = (env.R2_PRESCRIPTION_PREFIX || 'prescriptions').replace(/^\/+|\/+$/g, '');
    const objectKey = `${prefix}/${filename}`;

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: file.buffer,
          ContentType: mime,
          CacheControl: 'private, no-store',
          ContentDisposition: 'attachment',
          Metadata: {
            category: 'private-prescription',
          },
        })
      );

      return {
        storageKey: `${R2_KEY_PREFIX}${objectKey}`,
        objectKey,
        provider: 'cloudflare_r2',
        mimeType: mime,
        size,
        originalName: file.originalname || filename,
      };
    } catch (err) {
      throw new ApiError(
        502,
        `Failed to upload private prescription to Cloudflare R2: ${err.message}`
      );
    }
  }

  if (env.NODE_ENV === 'production' && env.ALLOW_EPHEMERAL_UPLOADS !== 'true') {
    throw new ApiError(
      503,
      'Persistent private storage (Cloudflare R2) is not configured for prescription uploads in production.'
    );
  }

  // Local development fallback (preserves existing local files)
  ensureLocalDir(LOCAL_PRESCRIPTIONS_DIR);
  const filePath = path.resolve(LOCAL_PRESCRIPTIONS_DIR, filename);
  await fs.promises.writeFile(filePath, file.buffer);

  return {
    storageKey: filename,
    objectKey: filename,
    provider: 'local',
    mimeType: mime,
    size,
    originalName: file.originalname || filename,
  };
}

/**
 * Extracts and validates an R2 object key from a stored `r2://...` reference.
 */
export function parseR2ObjectKey(storageKey) {
  if (!storageKey || typeof storageKey !== 'string' || !storageKey.startsWith(R2_KEY_PREFIX)) {
    return null;
  }
  const key = storageKey.slice(R2_KEY_PREFIX.length);
  if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    throw ApiError.badRequest('Invalid private prescription storage key.');
  }
  return key;
}

/**
 * Streams a private prescription from Cloudflare R2 (for `r2://...` keys) or
 * from local private storage (for legacy local filenames) ONLY after caller
 * middleware has enforced authentication and RBAC.
 */
export async function getPrivatePrescriptionStream(storageKey, options = {}) {
  if (!storageKey || typeof storageKey !== 'string') {
    throw ApiError.notFound('No prescription file reference found.');
  }

  const env = options.env || process.env;
  const r2ObjectKey = parseR2ObjectKey(storageKey);

  if (r2ObjectKey) {
    if (!options.r2Client && !isR2Configured(env)) {
      throw new ApiError(503, 'Cloudflare R2 storage is not configured to retrieve this prescription.');
    }
    const client = options.r2Client || createR2Client(env);
    const bucket = (env.R2_PRIVATE_BUCKET || '').trim();

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: r2ObjectKey,
        })
      );

      if (!response || !response.Body) {
        throw ApiError.notFound('Prescription file was not found in private storage.');
      }

      return {
        stream: response.Body,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength,
        provider: 'cloudflare_r2',
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
        throw ApiError.notFound('Prescription file does not exist in private storage.');
      }
      throw new ApiError(502, `Failed to retrieve private prescription from Cloudflare R2: ${err.message}`);
    }
  }

  // Legacy local disk lookup with strict directory traversal containment
  const safeFilename = path.basename(storageKey);
  if (!safeFilename || safeFilename !== storageKey) {
    throw ApiError.badRequest('Invalid prescription filename.');
  }

  const filePath = path.resolve(LOCAL_PRESCRIPTIONS_DIR, safeFilename);
  if (!filePath.startsWith(LOCAL_PRESCRIPTIONS_DIR + path.sep) || !fs.existsSync(filePath)) {
    throw ApiError.notFound('Prescription file does not exist on disk.');
  }

  const stat = fs.statSync(filePath);
  return {
    stream: fs.createReadStream(filePath),
    contentType: null,
    contentLength: stat.size,
    provider: 'local',
    filePath,
  };
}

/**
 * Generates a short-lived presigned GET URL (30s–300s) for a private prescription stored in Cloudflare R2.
 * Never returns public URLs.
 */
export async function getPrivatePrescriptionSignedUrl(storageKey, options = {}) {
  const env = options.env || process.env;
  const r2ObjectKey = parseR2ObjectKey(storageKey);
  if (!r2ObjectKey) {
    throw ApiError.badRequest('Signed URLs are only supported for private Cloudflare R2 prescriptions.');
  }

  if (!options.r2Client && !isR2Configured(env)) {
    throw new ApiError(503, 'Cloudflare R2 storage is not configured to sign prescription URLs.');
  }

  const rawTtl = parseInt(
    String(options.expiresInSeconds ?? env.R2_SIGNED_URL_TTL_SECONDS ?? DEFAULT_SIGNED_URL_TTL),
    10
  );
  const expiresIn = Math.min(
    MAX_SIGNED_URL_TTL,
    Math.max(MIN_SIGNED_URL_TTL, Number.isFinite(rawTtl) ? rawTtl : DEFAULT_SIGNED_URL_TTL)
  );

  const client = options.r2Client || createR2Client(env);
  const signer = options.urlSigner || getSignedUrl;
  const bucket = (env.R2_PRIVATE_BUCKET || '').trim();

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: r2ObjectKey,
      ResponseCacheControl: 'private, no-store',
    });
    const signedUrl = await signer(client, command, { expiresIn });
    return {
      url: signedUrl,
      expiresInSeconds: expiresIn,
      provider: 'cloudflare_r2',
    };
  } catch (err) {
    throw new ApiError(502, `Failed to generate signed URL for private prescription: ${err.message}`);
  }
}

export default {
  isCloudinaryConfigured,
  isR2Configured,
  getR2Endpoint,
  getStorageConfigStatus,
  hasValidMagicBytes,
  validateUploadedFile,
  uploadDoctorPhoto,
  uploadPrivatePrescription,
  parseR2ObjectKey,
  getPrivatePrescriptionStream,
  getPrivatePrescriptionSignedUrl,
};
