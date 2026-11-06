import { Router } from 'express';
import reportController from '../controllers/report.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Reports access restricted to Admin, Pharmacist, and Stock Manager
router.use(authenticate, hasRole(ROLES.ADMIN, ROLES.PHARMACIST, ROLES.STOCK_MANAGER));

router.get('/sales', reportController.getSalesReport);
router.get('/valuation', reportController.getStockValuation);
router.get('/low-stock', reportController.getLowStockReport);
router.get('/near-expiry', reportController.getNearExpiryReport);
router.get('/departments', reportController.getDepartmentPrescriptions);
router.get('/profit-loss', reportController.getProfitLossReport);

export default router;
