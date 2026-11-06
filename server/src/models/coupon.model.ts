import { Schema, model, Model, Types, HydratedDocument } from 'mongoose';

export type DiscountType = 'percentage' | 'fixed';

export interface ICoupon {
  _id?: Types.ObjectId;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maximumDiscountAmount?: number;
  minimumOrderAmount: number;
  startDate: Date;
  expiryDate: Date;
  totalUsageLimit?: number;
  perUserUsageLimit: number;
  usageCount: number;
  applicableProducts: Types.ObjectId[];
  applicableCategories: Types.ObjectId[];
  applicableVendors: Types.ObjectId[];
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type CouponDocument = HydratedDocument<ICoupon>;
export type CouponModel = Model<ICoupon>;

const couponSchema = new Schema<ICoupon, CouponModel>(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [3, 'Coupon code must be at least 3 characters'],
      maxlength: [30, 'Coupon code cannot exceed 30 characters'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Coupon description is required'],
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0.01, 'Discount value must be greater than zero'],
    },
    maximumDiscountAmount: {
      type: Number,
      min: [0.01, 'Maximum discount amount must be greater than zero'],
      default: undefined,
    },
    minimumOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount cannot be negative'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    totalUsageLimit: {
      type: Number,
      min: [1, 'Total usage limit must be at least 1'],
      default: undefined,
    },
    perUserUsageLimit: {
      type: Number,
      default: 1,
      min: [1, 'Per-user usage limit must be at least 1'],
    },
    usageCount: {
      type: Number,
      default: 0,
      min: [0, 'Usage count cannot be negative'],
    },
    applicableProducts: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
      default: [],
    },
    applicableCategories: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
      default: [],
    },
    applicableVendors: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by admin user reference is required'],
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
        if (ret.createdBy && typeof ret.createdBy === 'object' && ret.createdBy._id) {
          ret.createdBy = ret.createdBy._id.toString();
        }
        return ret;
      },
    },
  }
);

// Query indexes
couponSchema.index({ isActive: 1, startDate: 1, expiryDate: 1 });
couponSchema.index({ createdAt: -1 });

export const Coupon = model<ICoupon, CouponModel>('Coupon', couponSchema);
