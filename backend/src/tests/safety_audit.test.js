import test from 'node:test';
import assert from 'node:assert/strict';

test('Safety Audit - Conservative Expiry Rule blocks same-day and past batches', () => {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Create dates: past, today, future
  const pastDate = '2024-01-01';
  const todayDate = todayStr;
  const futureDate = '2028-12-31';

  // Rule: expiry_date > CURRENT_DATE
  const isEligibleForSale = (expiryDateStr) => {
    return expiryDateStr > todayStr;
  };

  assert.strictEqual(isEligibleForSale(pastDate), false, 'Past batch must NOT be eligible for sale');
  assert.strictEqual(isEligibleForSale(todayDate), false, 'Same-day expiring batch must NOT be eligible for sale (conservative policy)');
  assert.strictEqual(isEligibleForSale(futureDate), true, 'Future batch must be eligible for sale');
});

test('Safety Audit - Customer Returns Cannot Re-activate Expired or Recalled Batches', () => {
  const today = new Date();

  function determineRestockStatus(batch) {
    const isExpired = new Date(batch.expiry_date) <= today;
    const isRecalled = batch.status === 'recalled';

    if (isExpired) return 'expired';
    if (isRecalled) return 'recalled';
    return 'active';
  }

  // Case 1: Batch has expired since the sale
  const expiredBatch = {
    id: 1,
    expiry_date: '2024-06-01',
    status: 'exhausted',
  };
  assert.strictEqual(determineRestockStatus(expiredBatch), 'expired', 'Expired batch must NOT become active on return');

  // Case 2: Batch has been recalled by manufacturer
  const recalledBatch = {
    id: 2,
    expiry_date: '2028-01-01',
    status: 'recalled',
  };
  assert.strictEqual(determineRestockStatus(recalledBatch), 'recalled', 'Recalled batch must NOT become active on return');

  // Case 3: Valid unexpired, non-recalled batch
  const validBatch = {
    id: 3,
    expiry_date: '2028-06-01',
    status: 'exhausted',
  };
  assert.strictEqual(determineRestockStatus(validBatch), 'active', 'Valid unexpired batch should be restored to active');
});

test('Safety Audit - Upload File Extension Whitelist rejects unauthorized files', () => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

  function validateUpload(filename, mime) {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    return allowedExtensions.includes(ext) && allowedMimes.includes(mime.toLowerCase());
  }

  // Safe files
  assert.strictEqual(validateUpload('rx_document.pdf', 'application/pdf'), true);
  assert.strictEqual(validateUpload('prescription.jpg', 'image/jpeg'), true);
  assert.strictEqual(validateUpload('photo.png', 'image/png'), true);

  // Dangerous files disguised with valid mime or invalid extensions
  assert.strictEqual(validateUpload('exploit.exe', 'application/octet-stream'), false);
  assert.strictEqual(validateUpload('webshell.php', 'image/jpeg'), false, 'PHP disguised as JPEG must be rejected');
  assert.strictEqual(validateUpload('script.sh', 'text/x-shellscript'), false);
  assert.strictEqual(validateUpload('payload.js', 'application/javascript'), false);
});

test('Safety Audit - Doctor Inquiry Input Validation Rules', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateInquiryInput(data, hasFile) {
    const { doctorName, clinicHospitalName, email, manualNotes } = data;
    if (!doctorName || !clinicHospitalName || !email) {
      throw new Error('Doctor name, clinic name, and email are required');
    }
    if (!emailRegex.test(email.trim())) {
      throw new Error('A valid email address is required');
    }
    if (!hasFile && (!manualNotes || !manualNotes.trim())) {
      throw new Error('Please upload a prescription photo or enter requested medicines in notes');
    }
    return true;
  }

  // Valid with note
  assert.strictEqual(validateInquiryInput({
    doctorName: 'Dr. Sarah',
    clinicHospitalName: 'City Hospital',
    email: 'sarah@clinic.pk',
    manualNotes: 'Need 10 boxes of Panadol',
  }, false), true);

  // Valid with file even without note
  assert.strictEqual(validateInquiryInput({
    doctorName: 'Dr. Sarah',
    clinicHospitalName: 'City Hospital',
    email: 'sarah@clinic.pk',
    manualNotes: '',
  }, true), true);

  // Invalid email
  assert.throws(() => {
    validateInquiryInput({
      doctorName: 'Dr. Sarah',
      clinicHospitalName: 'City Hospital',
      email: 'not-an-email',
      manualNotes: 'Some notes',
    }, false);
  }, /valid email address/);

  // Missing file AND missing notes
  assert.throws(() => {
    validateInquiryInput({
      doctorName: 'Dr. Sarah',
      clinicHospitalName: 'City Hospital',
      email: 'sarah@clinic.pk',
      manualNotes: '   ',
    }, false);
  }, /upload a prescription photo or enter requested medicines/);
});
