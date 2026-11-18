import { Router } from 'express';
import prescriptionController from '../controllers/prescription.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Authenticated & authorized prescription file streaming (Admin, Pharmacist, Doctor)
router.get(
  '/files/:filename',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST, ROLES.DOCTOR),
  prescriptionController.streamPrescriptionFile
);

// RESTRICTED ACCESS: Only Pharmacist and Admin can view or verify prescription records
router.use(authenticate, hasRole(ROLES.ADMIN, ROLES.PHARMACIST));

router.get('/', prescriptionController.listPrescriptions);
router.post('/', prescriptionController.createPrescription);
router.get('/:id', prescriptionController.getPrescription);
router.post('/:id/verify', prescriptionController.verifyPrescription);

export default router;
