import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

const router = Router();

// GET /api/health or /api/v1/health
router.get('/', HealthController.getHealth);

// GET /api/health/redis
router.get('/redis', HealthController.getRedisHealth);

// GET /api/health/elasticsearch
router.get('/elasticsearch', HealthController.getElasticHealth);

export const healthRoutes = router;

