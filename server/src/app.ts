import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.config';
import { healthRoutes } from './routes/health.routes';
import { authRoutes } from './routes/auth.routes';
import { customerRoutes } from './routes/customer.routes';
import { vendorRoutes } from './routes/vendor.routes';
import { vendorProfileRoutes } from './routes/vendorProfile.routes';
import { adminRoutes } from './routes/admin.routes';
import { categoryRoutes } from './routes/category.routes';
import { productRoutes } from './routes/product.routes';
import { cartRoutes } from './routes/cart.routes';
import { addressRoutes } from './routes/address.routes';
import { checkoutRoutes } from './routes/checkout.routes';
import { orderRoutes } from './routes/order.routes';
import { v1Router } from './routes/v1';
import { notFoundMiddleware } from './middlewares/notFound.middleware';
import { errorMiddleware } from './middlewares/error.middleware';

export const createApp = (): Application => {
  const app = express();

  // Security Headers
  app.use(helmet());

  // CORS Configuration
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Request Body Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // HTTP Request Logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // Root welcome endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      success: true,
      name: 'Multi-Vendor E-Commerce Marketplace API',
      version: '1.0.0',
      status: 'online',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        v1: '/api/v1',
      },
    });
  });

  // Health check endpoints
  app.use('/api/health', healthRoutes);
  app.use('/api/v1/health', healthRoutes);
  app.use('/health', healthRoutes);

  // Auth endpoints (mounted on /api/auth, /auth, and /api/v1/auth)
  app.use('/api/auth', authRoutes);
  app.use('/auth', authRoutes);

  // Role endpoints
  app.use('/api/customer', customerRoutes);
  app.use('/customer', customerRoutes);
  app.use('/api/vendor', vendorRoutes);
  app.use('/vendor', vendorRoutes);
  app.use('/api/vendors', vendorProfileRoutes);
  app.use('/vendors', vendorProfileRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/admin', adminRoutes);

  // Catalog & Product endpoints
  app.use('/api/categories', categoryRoutes);
  app.use('/categories', categoryRoutes);
  app.use('/api/products', productRoutes);
  app.use('/products', productRoutes);

  // Cart endpoints
  app.use('/api/cart', cartRoutes);
  app.use('/cart', cartRoutes);

  // Address endpoints
  app.use('/api/addresses', addressRoutes);
  app.use('/addresses', addressRoutes);

  // Checkout & Order endpoints
  app.use('/api/checkout', checkoutRoutes);
  app.use('/checkout', checkoutRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/orders', orderRoutes);

  // API v1 Router
  app.use('/api/v1', v1Router);

  // 404 Handler (must be registered after all routes)
  app.use(notFoundMiddleware);

  // Centralized Error Middleware (must be registered last)
  app.use(errorMiddleware);

  return app;
};
