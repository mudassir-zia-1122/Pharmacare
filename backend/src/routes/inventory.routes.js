import { Router } from 'express';
import inventoryController from '../controllers/inventory.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/batches', authenticate, inventoryController.listBatches);
router.get('/movements', authenticate, inventoryController.listStockMovements);
router.get('/alerts', authenticate, inventoryController.getExpiryAlerts);
router.get('/reports', authenticate, inventoryController.getInventoryReports);

router.post(
  '/batches',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST, ROLES.STOCK_MANAGER),
  inventoryController.createBatch
);

router.patch(
  '/batches/:id/adjust',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST, ROLES.STOCK_MANAGER),
  inventoryController.adjustStock
);

router.post(
  '/batches/:id/dispose',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST),
  inventoryController.disposeExpiredBatch
);

// Quarantine / Recall: Only Admin & Pharmacist
router.patch(
  '/batches/:id/status',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST),
  inventoryController.updateBatchStatus
);

export default router;
