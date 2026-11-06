import { Router } from 'express';
import * as patientController from '../controllers/patient.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/', patientController.getPatients);
router.get('/:id', patientController.getPatientById);
router.get('/:id/prescriptions', patientController.getPatientPrescriptions);
router.post(
  '/',
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST, ROLES.CASHIER),
  patientController.createPatient
);
router.put(
  '/:id',
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST),
  patientController.updatePatient
);
router.delete(
  '/:id',
  hasRole(ROLES.ADMIN),
  patientController.deletePatient
);

export default router;
