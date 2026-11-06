import { Router } from 'express';
import * as appointmentController from '../controllers/appointment.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// ==========================================
// Public Patient Endpoints
// ==========================================
router.get('/available-slots', appointmentController.getAvailableSlots);
router.post('/book', appointmentController.bookAppointment);
// Standard REST collection creation endpoint (alias to book)
router.post('/', appointmentController.bookAppointment);
router.post('/lookup', appointmentController.lookupAppointment);
router.get('/queue/display', appointmentController.getWaitingRoomDisplayQueue);

// ==========================================
// Clinic Staff & Admin Queue & Stats Endpoints
// ==========================================
const STAFF_ROLES = [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTION, ROLES.PHARMACIST];

router.get(
  '/stats/summary',
  authenticate,
  hasRole(...STAFF_ROLES),
  appointmentController.getAppointmentStatsSummary
);

router.get(
  '/queue/today',
  authenticate,
  hasRole(...STAFF_ROLES),
  appointmentController.getTodayQueue
);

router.post(
  '/queue/call-next',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTION),
  appointmentController.callNextPatient
);

router.post(
  '/walk-in',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTION),
  appointmentController.registerWalkInToken
);

// ==========================================
// Staff Appointment Management Endpoints
// ==========================================
router.get(
  '/',
  authenticate,
  hasRole(...STAFF_ROLES),
  appointmentController.getAppointments
);

router.get(
  '/:id',
  authenticate,
  hasRole(...STAFF_ROLES),
  appointmentController.getAppointmentById
);

router.patch(
  '/:id/status',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTION),
  appointmentController.updateAppointmentStatus
);

router.patch(
  '/:id/priority',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTION),
  appointmentController.assignEmergencyPriority
);

router.post(
  '/:id/reschedule',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTION),
  appointmentController.rescheduleAppointment
);

export default router;
