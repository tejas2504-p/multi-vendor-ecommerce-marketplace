import { Types } from 'mongoose';
import {
  Review,
  ReviewDocument,
  ReviewModerationStatus,
  ReviewVote,
  Product,
  Order,
  VendorOrder,
} from '../models';
import {
  CreateReviewInput,
  UpdateReviewInput,
  ReviewQueryInput,
  AdminReviewQueryInput,
} from '../validators/review.validator';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';

export interface RatingStatsResult {
  averageRating: number;
  reviewCount: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ReviewEligibilityResult {
  eligible: boolean;
  reason?: string;
  orderId?: string;
  vendorOrderId?: string;
  alreadyReviewed?: boolean;
  existingReviewId?: string;
}

export class ReviewService {
  /**
   * Task 2: Review Eligibility Validation
   * Enforces verified-purchase rules:
   * 1. Customer must own the parent order.
   * 2. The order must be paid.
   * 3. The vendor order containing the product must have status 'delivered'.
   * 4. Enforces review uniqueness: 1 review per customer per product.
   */
  static async checkEligibility(
    customerId: string,
    productId: string
  ): Promise<ReviewEligibilityResult> {
    if (!Types.ObjectId.isValid(productId)) {
      throw AppError.badRequest('Invalid product ID format');
    }

    const cId = new Types.ObjectId(customerId);
    const pId = new Types.ObjectId(productId);

    // Verify product exists and is not deleted
    const product = await Product.findOne({ _id: pId, isDeleted: false });
    if (!product) {
      throw AppError.notFound('Product not found');
    }

    // Check if customer already reviewed this product (Uniqueness policy: 1 review per product)
    const existingReview = await Review.findOne({ userId: cId, productId: pId });
    if (existingReview) {
      return {
        eligible: false,
        alreadyReviewed: true,
        existingReviewId: existingReview._id.toString(),
        reason: 'You have already reviewed this product. Please update your existing review.',
      };
    }

    // Find all paid parent orders belonging to this customer
    const customerOrders = await Order.find({
      $or: [{ customerId: cId }, { userId: cId }],
      paymentStatus: 'paid',
    }).select('_id');

    if (!customerOrders || customerOrders.length === 0) {
      return {
        eligible: false,
        reason: 'You can only review products from delivered orders that you have purchased.',
      };
    }

    const parentOrderIds = customerOrders.map((o) => o._id);

    // Find a delivered vendor order containing this specific product
    const deliveredVendorOrder = await VendorOrder.findOne({
      parentOrderId: { $in: parentOrderIds },
      orderStatus: 'delivered',
      'items.productId': pId,
    });

    if (deliveredVendorOrder) {
      return {
        eligible: true,
        orderId: deliveredVendorOrder.parentOrderId.toString(),
        vendorOrderId: deliveredVendorOrder._id.toString(),
      };
    }

    // If not delivered yet, check if they at least ordered it to provide a helpful reason
    const pendingVendorOrder = await VendorOrder.findOne({
      parentOrderId: { $in: parentOrderIds },
      'items.productId': pId,
    });

    if (pendingVendorOrder) {
      return {
        eligible: false,
        reason: 'You can only review this product once your order has been successfully delivered.',
      };
    }

    return {
      eligible: false,
      reason: 'You can only review products from delivered orders that you have purchased.',
    };
  }

  /**
   * Task 3: Create verified review
   */
  static async createReview(
    customerId: string,
    productId: string,
    input: CreateReviewInput
  ): Promise<ReviewDocument> {
    const eligibility = await this.checkEligibility(customerId, productId);

    if (!eligibility.eligible) {
      if (eligibility.alreadyReviewed) {
        throw AppError.conflict(eligibility.reason || 'You have already reviewed this product.');
      }
      throw AppError.forbidden(eligibility.reason || 'You are not eligible to review this product.');
    }

    const review = await Review.create({
      userId: new Types.ObjectId(customerId),
      productId: new Types.ObjectId(productId),
      orderId: new Types.ObjectId(eligibility.orderId!),
      vendorOrderId: eligibility.vendorOrderId ? new Types.ObjectId(eligibility.vendorOrderId) : undefined,
      rating: input.rating,
      title: input.title,
      comment: input.comment,
      isVerifiedPurchase: true,
      moderationStatus: 'approved',
      helpfulCount: 0,
    });

    // Task 5: Recalculate product rating stats
    await this.recalculateProductRatingStats(productId);

    logger.info(`Customer ${customerId} created verified review for product ${productId} with rating ${input.rating}`);

    return review;
  }

  /**
   * Task 3 & 5: Public product reviews list with summary metrics, filters, sorting, and pagination
   */
  static async getProductReviews(
    productId: string,
    query: ReviewQueryInput,
    currentUserId?: string
  ) {
    if (!Types.ObjectId.isValid(productId)) {
      throw AppError.badRequest('Invalid product ID format');
    }

    const pId = new Types.ObjectId(productId);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Public query strictly filters for 'approved' moderation status
    const filter: Record<string, any> = {
      productId: pId,
      moderationStatus: 'approved',
    };

    if (query.rating) {
      filter.rating = query.rating;
    }

    // Dynamic sorting
    let sortOptions: Record<string, any> = { createdAt: -1 };
    switch (query.sort) {
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'highest_rated':
        sortOptions = { rating: -1, createdAt: -1 };
        break;
      case 'lowest_rated':
        sortOptions = { rating: 1, createdAt: -1 };
        break;
      case 'most_helpful':
        sortOptions = { helpfulCount: -1, createdAt: -1 };
        break;
      case 'newest':
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    const [reviews, totalCount, stats] = await Promise.all([
      Review.find(filter)
        .populate('userId', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
      this.calculateRatingDistribution(pId),
    ]);

    // Annotate reviews with user's helpful vote status and ownership
    let userVotedReviewIds = new Set<string>();
    let userEligibility: ReviewEligibilityResult | null = null;

    if (currentUserId && Types.ObjectId.isValid(currentUserId)) {
      const reviewIds = reviews.map((r) => r._id);
      const userVotes = await ReviewVote.find({
        userId: new Types.ObjectId(currentUserId),
        reviewId: { $in: reviewIds },
      }).select('reviewId');

      userVotedReviewIds = new Set(userVotes.map((v) => v.reviewId.toString()));

      try {
        userEligibility = await this.checkEligibility(currentUserId, productId);
      } catch {
        userEligibility = null;
      }
    }

    const formattedReviews = reviews.map((r) => {
      const u: any = r.userId;
      const authorId = u && typeof u === 'object' && u._id ? u._id.toString() : String(u || '');
      const authorName = u && typeof u === 'object' && u.name ? String(u.name) : 'Verified Customer';

      return {
        ...r,
        id: r._id.toString(),
        author: {
          id: authorId,
          name: authorName,
        },
        hasVotedHelpful: userVotedReviewIds.has(r._id.toString()),
        isAuthor: Boolean(currentUserId && authorId === currentUserId),
      };
    });

    return {
      reviews: formattedReviews,
      summary: stats,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit) || 1,
      },
      userEligibility,
    };
  }

  /**
   * Task 3: Update existing review
   */
  static async updateReview(
    reviewId: string,
    customerId: string,
    input: UpdateReviewInput
  ): Promise<ReviewDocument> {
    if (!Types.ObjectId.isValid(reviewId)) {
      throw AppError.badRequest('Invalid review ID format');
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      throw AppError.notFound('Review not found');
    }

    // Ownership check: Customer can only update their own review
    if (review.userId.toString() !== customerId) {
      throw AppError.forbidden('You can only edit your own review');
    }

    const ratingChanged = input.rating !== undefined && input.rating !== review.rating;

    if (input.rating !== undefined) review.rating = input.rating;
    if (input.title !== undefined) review.title = input.title;
    if (input.comment !== undefined) review.comment = input.comment;

    await review.save();

    // Recalculate stats if rating was modified
    if (ratingChanged) {
      await this.recalculateProductRatingStats(review.productId);
    }

    logger.info(`Customer ${customerId} updated review ${reviewId}`);
    return review;
  }

  /**
   * Task 3: Delete review (by review owner or admin)
   */
  static async deleteReview(
    reviewId: string,
    userId: string,
    isAdmin = false
  ): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(reviewId)) {
      throw AppError.badRequest('Invalid review ID format');
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      throw AppError.notFound('Review not found');
    }

    // Authorization check
    if (review.userId.toString() !== userId && !isAdmin) {
      throw AppError.forbidden('You do not have permission to delete this review');
    }

    const productId = review.productId;

    // Delete review and associated votes
    await Promise.all([
      Review.deleteOne({ _id: review._id }),
      ReviewVote.deleteMany({ reviewId: review._id }),
    ]);

    // Recalculate product rating stats
    await this.recalculateProductRatingStats(productId);

    logger.info(`Review ${reviewId} deleted by user ${userId} (isAdmin: ${isAdmin})`);
    return { message: 'Review deleted successfully' };
  }

  /**
   * Task 6: Helpful Review Voting (Toggleable, prevents self-voting, exactly 1 vote per customer)
   */
  static async voteHelpful(
    reviewId: string,
    customerId: string
  ): Promise<{ voted: boolean; helpfulCount: number }> {
    if (!Types.ObjectId.isValid(reviewId)) {
      throw AppError.badRequest('Invalid review ID format');
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      throw AppError.notFound('Review not found');
    }

    // Self-voting prevention: authors cannot vote on their own review
    if (review.userId.toString() === customerId) {
      throw AppError.badRequest('You cannot vote on your own review');
    }

    const cId = new Types.ObjectId(customerId);
    const existingVote = await ReviewVote.findOne({
      reviewId: review._id,
      userId: cId,
    });

    if (existingVote) {
      // Toggle off: remove vote
      await ReviewVote.deleteOne({ _id: existingVote._id });
      const updated = await Review.findByIdAndUpdate(
        review._id,
        { $inc: { helpfulCount: -1 } },
        { new: true }
      );
      const newCount = Math.max(0, updated?.helpfulCount || 0);
      if (updated && updated.helpfulCount < 0) {
        await Review.updateOne({ _id: review._id }, { $set: { helpfulCount: 0 } });
      }
      return { voted: false, helpfulCount: newCount };
    } else {
      // Toggle on: add vote
      await ReviewVote.create({
        reviewId: review._id,
        userId: cId,
        vote: 'helpful',
      });
      const updated = await Review.findByIdAndUpdate(
        review._id,
        { $inc: { helpfulCount: 1 } },
        { new: true }
      );
      return { voted: true, helpfulCount: updated?.helpfulCount || 1 };
    }
  }

  /**
   * Task 4: Admin reviews list with moderation filters
   */
  static async adminListReviews(query: AdminReviewQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (query.status) filter.moderationStatus = query.status;
    if (query.productId) filter.productId = new Types.ObjectId(query.productId);
    if (query.userId) filter.userId = new Types.ObjectId(query.userId);

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('userId', 'name email')
        .populate('productId', 'name price images')
        .populate('moderatedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Task 4: Admin updates moderation status (approved, hidden, rejected, pending)
   */
  static async adminUpdateModerationStatus(
    reviewId: string,
    adminId: string,
    status: ReviewModerationStatus,
    reason?: string
  ): Promise<ReviewDocument> {
    if (!Types.ObjectId.isValid(reviewId)) {
      throw AppError.badRequest('Invalid review ID format');
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      throw AppError.notFound('Review not found');
    }

    const previousStatus = review.moderationStatus;
    review.moderationStatus = status;
    review.moderatedBy = new Types.ObjectId(adminId);
    review.moderatedAt = new Date();
    if (reason) review.moderationReason = reason;

    await review.save();

    // If approval status changed, recalculate product rating stats
    if (previousStatus !== status) {
      await this.recalculateProductRatingStats(review.productId);
    }

    logger.info(`Admin ${adminId} updated review ${reviewId} moderation status to '${status}'`);
    return review;
  }

  /**
   * Task 5: Rating calculation helper
   * Aggregates only 'approved' reviews to compute:
   * - Average rating (0.0 to 5.0, rounded to 1 decimal place)
   * - Total review count
   * - Rating distribution breakdown (1 to 5 stars)
   */
  static async calculateRatingDistribution(
    productId: Types.ObjectId
  ): Promise<RatingStatsResult> {
    const stats = await Review.aggregate([
      {
        $match: {
          productId,
          moderationStatus: 'approved',
        },
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalCount = 0;
    let totalRatingSum = 0;

    for (const item of stats) {
      const r = Number(item._id);
      if (r >= 1 && r <= 5) {
        distribution[r as keyof typeof distribution] = item.count;
        totalCount += item.count;
        totalRatingSum += r * item.count;
      }
    }

    const averageRating =
      totalCount > 0 ? Math.round((totalRatingSum / totalCount) * 10) / 10 : 0;

    return {
      averageRating,
      reviewCount: totalCount,
      ratingDistribution: distribution,
    };
  }

  /**
   * Task 5: Recalculates and synchronizes averageRating and reviewCount on the Product model
   */
  static async recalculateProductRatingStats(
    productId: string | Types.ObjectId
  ): Promise<RatingStatsResult> {
    const pId = typeof productId === 'string' ? new Types.ObjectId(productId) : productId;
    const stats = await this.calculateRatingDistribution(pId);

    await Product.findByIdAndUpdate(pId, {
      averageRating: stats.averageRating,
      reviewCount: stats.reviewCount,
    });

    return stats;
  }
}
