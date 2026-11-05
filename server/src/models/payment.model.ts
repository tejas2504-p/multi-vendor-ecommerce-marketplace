import { Schema, model, Model, Types, HydratedDocument } from 'mongoose';

export type PaymentRecordStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';

export interface IPayment {
  _id?: Types.ObjectId;
  customerId: Types.ObjectId;
  parentOrderId: Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  status: PaymentRecordStatus;
  failureReason?: string;
  verifiedAt?: Date;
  notes?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentDocument = HydratedDocument<IPayment>;
export type PaymentModel = Model<IPayment>;

const paymentSchema = new Schema<IPayment, PaymentModel>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    parentOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Parent order reference is required'],
      index: true,
    },
    razorpayOrderId: {
      type: String,
      required: [true, 'Razorpay order ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    razorpaySignature: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Payment amount cannot be negative'],
    },
    currency: {
      type: String,
      required: [true, 'Payment currency is required'],
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: 'unknown',
    },
    status: {
      type: String,
      enum: ['pending', 'authorized', 'captured', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    verifiedAt: {
      type: Date,
    },
    notes: {
      type: Map,
      of: String,
      default: () => new Map(),
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
        if (ret.customerId && typeof ret.customerId === 'object' && ret.customerId.toString) {
          ret.customerId = ret.customerId.toString();
        }
        if (ret.parentOrderId && typeof ret.parentOrderId === 'object' && ret.parentOrderId.toString) {
          ret.parentOrderId = ret.parentOrderId.toString();
        }
        return ret;
      },
    },
  }
);

paymentSchema.index({ customerId: 1, createdAt: -1 });
paymentSchema.index({ parentOrderId: 1, status: 1 });

export const Payment = model<IPayment, PaymentModel>('Payment', paymentSchema);
