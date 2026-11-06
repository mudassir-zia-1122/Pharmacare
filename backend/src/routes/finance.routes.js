import { Router } from 'express';
import * as financeController from '../controllers/finance.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/summary', hasRole(ROLES.ADMIN, ROLES.STOCK_MANAGER), financeController.getFinancialSummary);
router.get('/daily-summary', hasRole(ROLES.ADMIN, ROLES.STOCK_MANAGER, ROLES.CASHIER), financeController.getDailySummary);
router.get('/cash-register', hasRole(ROLES.ADMIN, ROLES.CASHIER), financeController.getCashRegister);
router.get('/expenses', hasRole(ROLES.ADMIN, ROLES.STOCK_MANAGER), financeController.getExpenses);
router.get('/expenses/:id', hasRole(ROLES.ADMIN, ROLES.STOCK_MANAGER), financeController.getExpenseById);
router.post(
  '/expenses',
  hasRole(ROLES.ADMIN, ROLES.STOCK_MANAGER),
  financeController.createExpense
);
router.put(
  '/expenses/:id',
  hasRole(ROLES.ADMIN),
  financeController.updateExpense
);
router.delete(
  '/expenses/:id',
  hasRole(ROLES.ADMIN),
  financeController.deleteExpense
);

export default router;
