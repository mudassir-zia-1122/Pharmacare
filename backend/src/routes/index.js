import { Router } from 'express';
import { checkDbHealth } from '../config/db.js';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import medicineRoutes from './medicine.routes.js';
import inventoryRoutes from './inventory.routes.js';
import purchaseRoutes from './purchase.routes.js';
import posRoutes from './pos.routes.js';
import returnRoutes from './return.routes.js';
import prescriptionRoutes from './prescription.routes.js';
import reportRoutes from './report.routes.js';
import settingsRoutes from './settings.routes.js';
import inquiryRoutes from './inquiry.routes.js';
import userRoutes from './user.routes.js';
import customerRoutes from './customer.routes.js';
import doctorRoutes from './doctor.routes.js';
import patientRoutes from './patient.routes.js';
import financeRoutes from './finance.routes.js';
import notificationRoutes from './notification.routes.js';
import supplierRoutes from './supplier.routes.js';
import appointmentRoutes from './appointment.routes.js';

const router = Router();

// Public Health Check Endpoint
router.get('/health', async (req, res) => {
  const dbHealth = await checkDbHealth();
  const statusCode = dbHealth.ok ? 200 : 503;
  return res.status(statusCode).json({
    status: dbHealth.ok ? 'healthy' : 'degraded',
    serverTime: new Date().toISOString(),
    database: dbHealth,
    version: '1.0.0',
  });
});

// Mount domain modules
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/medicines', medicineRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/pos', posRoutes);
router.use('/returns', returnRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingsRoutes);
router.use('/inquiries', inquiryRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/doctors', doctorRoutes);
router.use('/patients', patientRoutes);
router.use('/finance', financeRoutes);
router.use('/notifications', notificationRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/appointments', appointmentRoutes);

export default router;
