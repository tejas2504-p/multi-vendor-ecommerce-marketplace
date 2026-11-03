import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

const router = Router();

// GET /api/health or /api/v1/health
router.get('/', HealthController.getHealth);

export const healthRoutes = router;

