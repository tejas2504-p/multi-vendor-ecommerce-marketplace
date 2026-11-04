import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { authLimiter } from '../middlewares/rateLimiter.middleware';
import { registerSchema, loginSchema } from '../validators/auth.validator';

const router = Router();

// Public auth routes with rate limiting
router.post('/register', authLimiter, validateBody(registerSchema), AuthController.register);
router.post('/login', authLimiter, validateBody(loginSchema), AuthController.login);
router.post('/logout', AuthController.logout);

// Authenticated session route
router.get('/me', authenticate, AuthController.getMe);

export const authRoutes = router;

