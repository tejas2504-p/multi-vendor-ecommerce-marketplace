import { Schema, model, Model, Types, HydratedDocument } from 'mongoose';

export type PayoutStatus =
  | 'requested'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'rejected'
  | 'failed';

export interface IVendorPayout {
  _id?: Types.ObjectId;
  vendorId: Types.ObjectId;
  payoutNumber: string;
  requestedAmount: number;
  approvedAmount?: number;
  payoutStatus: PayoutStatus;
  destinationReference: string;
  providerReference?: string;
  failureReason?: string;
  rejectionReason?: string;
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: Types.ObjectId;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type VendorPayoutDocument = HydratedDocument<IVendorPayout>;
export type VendorPayoutModel = Model<IVendorPayout>;

const vendorPayoutSchema = new Schema<IVendorPayout, VendorPayoutModel>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    payoutNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: [1, 'Requested amount must be at least 1'],
    },
    approvedAmount: {
      type: Number,
      min: [0, 'Approved amount cannot be negative'],
    },
    payoutStatus: {
      type: String,
      enum: ['requested', 'approved', 'processing', 'paid', 'rejected', 'failed'],
      default: 'requested',
      index: true,
    },
    destinationReference: {
      type: String,
      required: true,
      trim: true,
    },
    providerReference: {
      type: String,
      trim: true,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
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
        if (ret.vendorId && typeof ret.vendorId === 'object' && ret.vendorId.toString) {
          ret.vendorId = ret.vendorId.toString();
        }
        return ret;
      },
    },
  }
);

vendorPayoutSchema.index({ vendorId: 1, createdAt: -1 });

export const VendorPayout = model<IVendorPayout, VendorPayoutModel>(
  'VendorPayout',
  vendorPayoutSchema
);
