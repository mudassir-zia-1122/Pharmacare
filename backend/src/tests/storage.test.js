import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Writable, Readable } from 'node:stream';
import app from '../app.js';
import { resetPool } from '../config/db.js';
import {
  isCloudinaryConfigured,
  isR2Configured,
  getStorageConfigStatus,
  validateUploadedFile,
  uploadDoctorPhoto,
  uploadPrivatePrescription,
  parseR2ObjectKey,
  getPrivatePrescriptionStream,
  getPrivatePrescriptionSignedUrl,
} from '../services/storage.service.js';

after(async () => {
  await resetPool();
});

// Minimal valid file headers (magic bytes) for testing
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const VALID_JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const VALID_PDF_BUFFER = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF', 'ascii');

async function withTestServer(fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('Storage Config - Rejects placeholders and reports sanitized status without exposing secrets', () => {
  const placeholderEnv = {
    NODE_ENV: 'production',
    CLOUDINARY_CLOUD_NAME: 'your_cloudinary_cloud_name',
    CLOUDINARY_API_KEY: 'your_cloudinary_api_key',
    CLOUDINARY_API_SECRET: 'your_cloudinary_api_secret',
    R2_ACCOUNT_ID: 'your_cloudflare_account_id',
    R2_ACCESS_KEY_ID: 'your_r2_access_key_id',
    R2_SECRET_ACCESS_KEY: 'your_r2_secret_access_key',
    R2_PRIVATE_BUCKET: 'pharmacare-private-prescriptions',
  };

  assert.strictEqual(isCloudinaryConfigured(placeholderEnv), false);
  assert.strictEqual(isR2Configured(placeholderEnv), false);

  const prodStatus = getStorageConfigStatus(placeholderEnv);
  assert.strictEqual(prodStatus.doctorPhotoProvider, 'unconfigured_blocked');
  assert.strictEqual(prodStatus.prescriptionProvider, 'unconfigured_blocked');
  assert.strictEqual(JSON.stringify(prodStatus).includes('secret'), false);

  const devStatus = getStorageConfigStatus({ NODE_ENV: 'development' });
  assert.strictEqual(devStatus.doctorPhotoProvider, 'local_dev');
  assert.strictEqual(devStatus.prescriptionProvider, 'local_dev');
});

test('Storage Validation - Enforces MIME type, extension, file size, and magic-byte signatures', () => {
  // Valid doctor photo (PNG)
  const validPhoto = validateUploadedFile(
    { originalname: 'doctor.png', mimetype: 'image/png', buffer: VALID_PNG_BUFFER, size: VALID_PNG_BUFFER.length },
    'doctor_photo'
  );
  assert.strictEqual(validPhoto.ext, '.png');

  // Valid prescription (PDF)
  const validPdf = validateUploadedFile(
    { originalname: 'rx.pdf', mimetype: 'application/pdf', buffer: VALID_PDF_BUFFER, size: VALID_PDF_BUFFER.length },
    'prescription'
  );
  assert.strictEqual(validPdf.ext, '.pdf');

  // Reject PDF uploaded as doctor photo
  assert.throws(
    () =>
      validateUploadedFile(
        { originalname: 'rx.pdf', mimetype: 'application/pdf', buffer: VALID_PDF_BUFFER, size: VALID_PDF_BUFFER.length },
        'doctor_photo'
      ),
    /Invalid photo format/
  );

  // Reject executable disguised with valid MIME
  assert.throws(
    () =>
      validateUploadedFile(
        { originalname: 'shell.php', mimetype: 'image/jpeg', buffer: VALID_JPEG_BUFFER, size: VALID_JPEG_BUFFER.length },
        'prescription'
      ),
    /Invalid file type or extension/
  );

  // Reject spoofed magic bytes (plain text claiming to be JPEG)
  assert.throws(
    () =>
      validateUploadedFile(
        { originalname: 'fake.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('not-a-jpeg-file'), size: 15 },
        'doctor_photo'
      ),
    /signature does not match/
  );

  // Reject oversized file (> 5 MB)
  assert.throws(
    () =>
      validateUploadedFile(
        { originalname: 'huge.png', mimetype: 'image/png', buffer: VALID_PNG_BUFFER, size: 6 * 1024 * 1024 },
        'prescription'
      ),
    /maximum permitted size of 5 MB/
  );
});

test('Cloudinary Upload - Uploads doctor photo securely and fails cleanly on outage or unconfigured prod', async () => {
  const validFile = {
    originalname: 'dr_tariq.jpg',
    mimetype: 'image/jpeg',
    buffer: VALID_JPEG_BUFFER,
    size: VALID_JPEG_BUFFER.length,
  };

  // Mock successful Cloudinary stream upload
  let capturedOptions = null;
  const mockCloudinary = {
    uploader: {
      upload_stream(opts, cb) {
        capturedOptions = opts;
        return new Writable({
          write(_chunk, _enc, next) { next(); },
          final(done) {
            cb(null, {
              secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${opts.folder}/${opts.public_id}.jpg`,
              public_id: `${opts.folder}/${opts.public_id}`,
            });
            done();
          },
        });
      },
    },
  };

  const result = await uploadDoctorPhoto(validFile, {
    cloudinaryClient: mockCloudinary,
    env: { NODE_ENV: 'production', CLOUDINARY_DOCTOR_FOLDER: 'pharmacare/doctors' },
  });
  assert.strictEqual(result.provider, 'cloudinary');
  assert.match(result.url, /^https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/.*\/pharmacare\/doctors\/doc_/);
  assert.strictEqual(capturedOptions.resource_type, 'image');

  // Mock Cloudinary failure -> 502
  const failingCloudinary = {
    uploader: {
      upload_stream(_opts, cb) {
        return new Writable({
          write(_chunk, _enc, next) { next(); },
          final(done) {
            cb(new Error('Upstream timeout'));
            done();
          },
        });
      },
    },
  };

  await assert.rejects(
    () => uploadDoctorPhoto(validFile, { cloudinaryClient: failingCloudinary, env: { NODE_ENV: 'production' } }),
    (err) => err.statusCode === 502 && /Failed to upload doctor photograph/.test(err.message)
  );

  // Production without Cloudinary credentials -> 503 (never silent ephemeral write)
  await assert.rejects(
    () => uploadDoctorPhoto(validFile, { env: { NODE_ENV: 'production' } }),
    (err) => err.statusCode === 503 && /Cloudinary/.test(err.message)
  );
});

test('Cloudflare R2 Private Prescriptions - Uploads privately, streams securely, signs short-lived URLs, and handles failures', async () => {
  const validRx = {
    originalname: 'patient_prescription.pdf',
    mimetype: 'application/pdf',
    buffer: VALID_PDF_BUFFER,
    size: VALID_PDF_BUFFER.length,
  };

  const r2Env = {
    NODE_ENV: 'production',
    R2_ACCOUNT_ID: 'acc123456',
    R2_ACCESS_KEY_ID: 'r2key123456',
    R2_SECRET_ACCESS_KEY: 'r2secret123456',
    R2_PRIVATE_BUCKET: 'pharmacare-private-rx',
    R2_PRESCRIPTION_PREFIX: 'prescriptions',
  };

  let sentPutCommand = null;
  const mockR2Client = {
    async send(command) {
      if (command.constructor.name === 'PutObjectCommand') {
        sentPutCommand = command.input;
        return { ETag: '"mock-etag"' };
      }
      if (command.constructor.name === 'GetObjectCommand') {
        if (command.input.Key.includes('missing')) {
          const err = new Error('NoSuchKey');
          err.name = 'NoSuchKey';
          throw err;
        }
        return {
          Body: Readable.from(VALID_PDF_BUFFER),
          ContentType: 'application/pdf',
          ContentLength: VALID_PDF_BUFFER.length,
        };
      }
      throw new Error('Unexpected S3 command');
    },
  };

  // 1. Private upload to R2
  const uploaded = await uploadPrivatePrescription(validRx, { r2Client: mockR2Client, env: r2Env });
  assert.strictEqual(uploaded.provider, 'cloudflare_r2');
  assert.match(uploaded.storageKey, /^r2:\/\/prescriptions\/rx_.*\.pdf$/);
  assert.strictEqual(sentPutCommand.Bucket, 'pharmacare-private-rx');
  assert.strictEqual(sentPutCommand.CacheControl, 'private, no-store');
  assert.strictEqual(sentPutCommand.ACL, undefined, 'Private prescription must never set a public ACL');

  // 2. Authenticated download / backend stream from R2
  const asset = await getPrivatePrescriptionStream(uploaded.storageKey, { r2Client: mockR2Client, env: r2Env });
  assert.strictEqual(asset.provider, 'cloudflare_r2');
  assert.strictEqual(asset.contentType, 'application/pdf');
  const chunks = [];
  for await (const chunk of asset.stream) chunks.push(chunk);
  assert.deepStrictEqual(Buffer.concat(chunks), VALID_PDF_BUFFER);

  // 3. Missing key in R2 -> 404
  await assert.rejects(
    () => getPrivatePrescriptionStream('r2://prescriptions/missing.pdf', { r2Client: mockR2Client, env: r2Env }),
    (err) => err.statusCode === 404
  );

  // 4. Path traversal key rejected -> 400
  assert.throws(() => parseR2ObjectKey('r2://../etc/passwd'), /Invalid private prescription storage key/);

  // 5. Short-lived signed URL generation enforces strict 30s-300s TTL ceiling
  let capturedTtl = null;
  const mockSigner = async (_client, _cmd, opts) => {
    capturedTtl = opts.expiresIn;
    return `https://acc123456.r2.cloudflarestorage.com/pharmacare-private-rx/prescriptions/rx.pdf?X-Amz-Expires=${opts.expiresIn}`;
  };
  const signed = await getPrivatePrescriptionSignedUrl(uploaded.storageKey, {
    r2Client: mockR2Client,
    env: r2Env,
    urlSigner: mockSigner,
    expiresInSeconds: 86400, // Attempt to request 24h TTL -> must be clamped to 300s
  });
  assert.strictEqual(capturedTtl, 300);
  assert.strictEqual(signed.expiresInSeconds, 300);
  assert.match(signed.url, /X-Amz-Expires=300/);

  // 6. R2 outage on upload -> 502
  const failingR2 = {
    async send() {
      throw new Error('R2 connection reset');
    },
  };
  await assert.rejects(
    () => uploadPrivatePrescription(validRx, { r2Client: failingR2, env: r2Env }),
    (err) => err.statusCode === 502 && /Cloudflare R2/.test(err.message)
  );

  // 7. Production without R2 configured -> 503
  await assert.rejects(
    () => uploadPrivatePrescription(validRx, { env: { NODE_ENV: 'production' } }),
    (err) => err.statusCode === 503 && /Cloudflare R2/.test(err.message)
  );
});

test('Storage Authorization - Blocks unauthenticated public access to prescriptions, signed URLs, and doctor photo uploads', async () => {
  await withTestServer(async (baseUrl) => {
    // Public direct static access to private prescriptions -> 403
    const publicRx = await fetch(`${baseUrl}/uploads/prescriptions/rx_private.pdf`);
    assert.strictEqual(publicRx.status, 403);

    // Unauthenticated signed-url request -> 401
    const unauthSigned = await fetch(`${baseUrl}/api/v1/prescriptions/signed-url?key=r2://prescriptions/rx_test.pdf`);
    assert.strictEqual(unauthSigned.status, 401);

    // Unauthenticated prescription file stream -> 401
    const unauthStream = await fetch(`${baseUrl}/api/v1/prescriptions/files/rx_test.pdf`);
    assert.strictEqual(unauthStream.status, 401);

    // Unauthenticated doctor photo upload -> 401
    const unauthDocUpload = await fetch(`${baseUrl}/api/v1/doctors/1/photo`, { method: 'POST' });
    assert.strictEqual(unauthDocUpload.status, 401);
  });
});
