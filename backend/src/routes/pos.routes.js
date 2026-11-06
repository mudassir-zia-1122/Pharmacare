import { Router } from 'express';
import posController from '../controllers/pos.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { checkoutValidator } from '../validators/index.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Search medicines for POS barcode scan or keyword
router.get('/search', authenticate, posController.searchMedicines);

// POS Checkout: Cashier, Pharmacist, Admin
router.post(
  '/checkout',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST, ROLES.CASHIER),
  checkoutValidator,
  validateRequest,
  posController.checkout
);

// Sales history and receipts
router.get('/sales', authenticate, posController.listSales);
router.get('/sales/:id', authenticate, posController.getSaleInvoice);

export default router;
