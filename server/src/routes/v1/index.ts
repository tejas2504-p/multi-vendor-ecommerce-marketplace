import { Router } from 'express';
import { healthRoutes } from '../health.routes';
import { authRoutes } from '../auth.routes';
import { customerRoutes } from '../customer.routes';
import { vendorRoutes } from '../vendor.routes';
import { vendorProfileRoutes } from '../vendorProfile.routes';
import { adminRoutes } from '../admin.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/customer', customerRoutes);
router.use('/vendor', vendorRoutes);
router.use('/vendors', vendorProfileRoutes);
router.use('/admin', adminRoutes);

export const v1Router = router;
