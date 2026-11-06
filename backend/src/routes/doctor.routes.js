import { Router } from 'express';
import * as doctorController from '../controllers/doctor.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { doctorPhotoUpload } from '../config/upload.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Publicly readable for appointment booking and directory
router.get('/departments', doctorController.getDepartments);
router.get('/leaves', authenticate, hasRole(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTION), doctorController.getDoctorLeaves);
router.get('/', doctorController.getDoctors);
router.get('/:id', doctorController.getDoctorById);
router.get('/:id/schedule', doctorController.getDoctorSchedule);

// Doctor Photograph Upload & Removal
router.post(
  '/:id/photo',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.DOCTOR),
  doctorPhotoUpload.single('photo'),
  doctorController.uploadDoctorPhoto
);

router.delete(
  '/:id/photo',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.DOCTOR),
  doctorController.removeDoctorPhoto
);

// Schedule Configuration
router.post(
  '/:id/schedule',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.DOCTOR),
  doctorController.saveDoctorSchedule
);

// Leave Management
router.post(
  '/leaves',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.DOCTOR),
  doctorController.createDoctorLeave
);

router.patch(
  '/leaves/:id/status',
  authenticate,
  hasRole(ROLES.ADMIN),
  doctorController.updateDoctorLeaveStatus
);

// Doctor Profile CRUD: Admin & authorized roles
router.post(
  '/',
  authenticate,
  hasRole(ROLES.ADMIN),
  doctorController.createDoctor
);

router.put(
  '/:id',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.DOCTOR),
  doctorController.updateDoctor
);

router.delete(
  '/:id',
  authenticate,
  hasRole(ROLES.ADMIN),
  doctorController.deleteDoctor
);

export default router;
