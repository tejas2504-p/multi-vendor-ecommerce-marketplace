import { Schema, model, Model, Types, HydratedDocument } from 'mongoose';

export type CouponUsageStatus = 'applied' | 'settled' | 'reversed';

export interface ICouponUsage {
  _id?: Types.ObjectId;
  couponId: Types.ObjectId;
  customerId: Types.ObjectId;
  orderId: Types.ObjectId;
  discountAmount: number;
  status: CouponUsageStatus;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CouponUsageDocument = HydratedDocument<ICouponUsage>;
export type CouponUsageModel = Model<ICouponUsage>;

const couponUsageSchema = new Schema<ICouponUsage, CouponUsageModel>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: [true, 'Coupon reference is required'],
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true,
    },
    discountAmount: {
      type: Number,
      required: [true, 'Discount amount is required'],
      min: [0, 'Discount amount cannot be negative'],
    },
    status: {
      type: String,
      enum: ['applied', 'settled', 'reversed'],
      default: 'applied',
      index: true,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
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

// Prevent duplicate usage records for the same order and coupon
couponUsageSchema.index({ couponId: 1, orderId: 1 }, { unique: true });
couponUsageSchema.index({ couponId: 1, customerId: 1 });
couponUsageSchema.index({ customerId: 1, createdAt: -1 });

export const CouponUsage = model<ICouponUsage, CouponUsageModel>('CouponUsage', couponUsageSchema);

