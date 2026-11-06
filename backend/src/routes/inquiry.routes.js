import { Router } from 'express';
import inquiryController from '../controllers/inquiry.controller.js';
import { prescriptionUpload } from '../config/upload.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { inquiryLimiter } from '../middleware/rateLimiter.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// ─── Public Doctor Inquiry Submission ─────────────────────────────────────────
// Doctors & clinics can submit availability checks without staff login
router.post(
  '/',
  inquiryLimiter,
  prescriptionUpload.single('prescription_image'),
  inquiryController.submitInquiry
);

// ─── Protected Pharmacy Staff Routes (Admin & Pharmacist) ─────────────────────
router.use(authenticate);
router.use(hasRole(ROLES.ADMIN, ROLES.PHARMACIST));

router.get('/smtp-status', inquiryController.getSmtpStatus);
router.post('/test-email', hasRole(ROLES.ADMIN), inquiryController.sendTestEmail);

router.get('/', inquiryController.listInquiries);
router.get('/:id', inquiryController.getInquiry);
router.get('/:id/image', inquiryController.streamInquiryImage);
router.post('/:id/items', inquiryController.saveItems);
router.post('/:id/respond', inquiryController.respond);
router.post('/:id/retry-email', inquiryController.retryEmail);

export default router;
