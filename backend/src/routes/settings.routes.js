import { Router } from 'express';
import settingsController from '../controllers/settings.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Public lookups for staff
router.get('/currencies', authenticate, settingsController.listCurrencies);
router.get('/tax-rules', authenticate, settingsController.listTaxRules);
router.get('/suppliers', authenticate, settingsController.listSuppliers);
router.post(
  '/suppliers',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.STOCK_MANAGER),
  settingsController.createSupplier
);
router.put(
  '/suppliers/:id',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.STOCK_MANAGER),
  settingsController.updateSupplier
);
router.delete(
  '/suppliers/:id',
  authenticate,
  hasRole(ROLES.ADMIN),
  settingsController.deleteSupplier
);
router.get('/customers', authenticate, settingsController.listCustomers);
// Public settings lookup (pharmacy name, currency, tax rules) for client bootstrap
router.get('/', settingsController.getSettings);

// Settings modification: Admin only
router.post(
  '/',
  authenticate,
  hasRole(ROLES.ADMIN),
  settingsController.updateSettings
);

export default router;
