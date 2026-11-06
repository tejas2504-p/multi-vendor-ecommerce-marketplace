import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody, validateParams } from '../middlewares/validate.middleware';
import {
  reviewParamSchema,
  updateReviewSchema,
} from '../validators/review.validator';
import { ReviewController } from '../controllers/review.controller';

const router = Router();

/**
 * PATCH /api/reviews/:reviewId
 * Protected: Customer edits their own review
 */
router.patch(
  '/:reviewId',
  authenticate,
  validateParams(reviewParamSchema),
  validateBody(updateReviewSchema),
  ReviewController.updateReview
);

/**
 * DELETE /api/reviews/:reviewId
 * Protected: Customer deletes their own review, or admin deletes review
 */
router.delete(
  '/:reviewId',
  authenticate,
  validateParams(reviewParamSchema),
  ReviewController.deleteReview
);

/**
 * POST /api/reviews/:reviewId/helpful
 * Protected: Customer votes / toggles helpful vote on a review
 */
router.post(
  '/:reviewId/helpful',
  authenticate,
  validateParams(reviewParamSchema),
  ReviewController.voteHelpful
);

export const reviewRoutes = router;

