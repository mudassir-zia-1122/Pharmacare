import { Router } from 'express';
import returnController from '../controllers/return.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/', authenticate, returnController.listReturns);

// Only Pharmacist and Admin can process customer or supplier returns
router.post(
  '/sales',
  authenticate,
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST),
  returnController.createSaleReturn
);

export default router;
