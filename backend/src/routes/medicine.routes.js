import { Router } from 'express';
import medicineController from '../controllers/medicine.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { medicineValidator } from '../validators/index.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Publicly readable for all authenticated staff
router.get('/', authenticate, medicineController.listMedicines);
router.get('/categories', authenticate, medicineController.listCategories);
router.get('/dosage-forms', authenticate, medicineController.listDosageForms);
router.get('/manufacturers', authenticate, medicineController.listManufacturers);
router.get('/:id', authenticate, medicineController.getMedicine);

// Protected: Only Admin & Pharmacist can create or modify medicines
router.post(
  '/import',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST),
  medicineController.importMedicines
);

router.post(
  '/',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST),
  medicineValidator,
  validateRequest,
  medicineController.createMedicine
);

router.put(
  '/:id',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST),
  medicineController.updateMedicine
);

router.patch(
  '/:id/status',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST),
  medicineController.updateMedicineStatus
);

router.post(
  '/categories',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST),
  medicineController.createCategory
);

export default router;
