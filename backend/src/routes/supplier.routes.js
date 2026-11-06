import { Router } from 'express';
import settingsController from '../controllers/settings.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/', authenticate, settingsController.listSuppliers);
router.post(
  '/',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.STOCK_MANAGER),
  settingsController.createSupplier
);
router.put(
  '/:id',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.STOCK_MANAGER),
  settingsController.updateSupplier
);
router.delete(
  '/:id',
  authenticate,
  hasRole(ROLES.ADMIN),
  settingsController.deleteSupplier
);

export default router;
