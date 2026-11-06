import { Router } from 'express';
import customerController from '../controllers/customer.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/', customerController.listCustomers);
router.get('/:id', customerController.getCustomer);
router.post(
  '/',
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST, ROLES.CASHIER),
  customerController.createCustomer
);
router.put(
  '/:id',
  hasRole(ROLES.ADMIN, ROLES.PHARMACIST, ROLES.CASHIER),
  customerController.updateCustomer
);
router.delete(
  '/:id',
  hasRole(ROLES.ADMIN),
  customerController.deleteCustomer
);

export default router;
