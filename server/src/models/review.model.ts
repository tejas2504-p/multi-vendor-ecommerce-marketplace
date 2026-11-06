import { Schema, model, Model, Types, HydratedDocument } from 'mongoose';

export type ReviewModerationStatus = 'pending' | 'approved' | 'hidden' | 'rejected';

export interface IReview {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  orderId: Types.ObjectId;
  vendorOrderId?: Types.ObjectId;
  rating: number; // 1 to 5 integer
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  moderationStatus: ReviewModerationStatus;
  moderationReason?: string;
  moderatedBy?: Types.ObjectId;
  moderatedAt?: Date;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ReviewDocument = HydratedDocument<IReview>;
export type ReviewModel = Model<IReview>;

const reviewSchema = new Schema<IReview, ReviewModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
      index: true,
    },
    vendorOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'VendorOrder',
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer between 1 and 5',
      },
    },
    title: {
      type: String,
      required: [true, 'Review title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      minlength: [5, 'Review comment must be at least 5 characters'],
      maxlength: [2000, 'Review comment cannot exceed 2000 characters'],
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },
    moderationStatus: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'hidden', 'rejected'],
        message: 'Invalid review moderation status',
      },
      default: 'approved',
      index: true,
    },
    moderationReason: {
      type: String,
      trim: true,
    },
    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    moderatedAt: {
      type: Date,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: [0, 'Helpful count cannot be negative'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.__v;
        if (ret._id) {
          ret.id = ret._id.toString();
          delete ret._id;
        }
        return ret;
      },
    },
  }
);

// Review Uniqueness Policy: exactly 1 review per customer per product
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Compound indexes for fast product review retrieval and sorting
reviewSchema.index({ productId: 1, moderationStatus: 1, createdAt: -1 });
reviewSchema.index({ productId: 1, moderationStatus: 1, rating: -1 });
reviewSchema.index({ productId: 1, moderationStatus: 1, helpfulCount: -1 });

export const Review = model<IReview, ReviewModel>('Review', reviewSchema);

