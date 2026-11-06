import { Router } from 'express';
import purchaseController from '../controllers/purchase.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/', authenticate, purchaseController.listPurchaseOrders);
router.get('/:id', authenticate, purchaseController.getPurchaseOrder);

// Only Stock Manager & Admin can create orders & receive stock
router.post(
  '/',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.STOCK_MANAGER),
  purchaseController.createPurchaseOrder
);

router.post(
  '/:id/receive',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.STOCK_MANAGER),
  purchaseController.receiveStock
);

export default router;
