import { Router } from 'express';
import { healthRoutes } from '../health.routes';
import { authRoutes } from '../auth.routes';
import { customerRoutes } from '../customer.routes';
import { vendorRoutes } from '../vendor.routes';
import { vendorProfileRoutes } from '../vendorProfile.routes';
import { adminRoutes } from '../admin.routes';
import { categoryRoutes } from '../category.routes';
import { productRoutes } from '../product.routes';
import { cartRoutes } from '../cart.routes';
import { addressRoutes } from '../address.routes';
import { checkoutRoutes } from '../checkout.routes';
import { orderRoutes } from '../order.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/customer', customerRoutes);
router.use('/vendor', vendorRoutes);
router.use('/vendors', vendorProfileRoutes);
router.use('/admin', adminRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/addresses', addressRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/orders', orderRoutes);

export const v1Router = router;
