import { Router } from 'express';
import userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { hasRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// RESTRICTED ACCESS: Only Administrators can manage staff user accounts and permissions
router.use(authenticate, hasRole(ROLES.ADMIN));

router.get('/', userController.listUsers);
router.get('/:id', userController.getUser);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.patch('/:id/toggle-status', userController.toggleStatus);

export default router;
