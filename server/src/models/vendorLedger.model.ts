import { Schema, model, Model, Types, HydratedDocument } from 'mongoose';

export type LedgerTransactionType =
  | 'order_earning'
  | 'payout_requested'
  | 'payout_processed'
  | 'payout_rejected'
  | 'payout_failed'
  | 'adjustment';

export type LedgerDirection = 'credit' | 'debit';

export interface IVendorLedger {
  _id?: Types.ObjectId;
  vendorId: Types.ObjectId;
  transactionType: LedgerTransactionType;
  direction: LedgerDirection;
  amount: number;
  balanceAfter: number;
  parentOrderId?: Types.ObjectId;
  vendorOrderId?: Types.ObjectId;
  payoutId?: Types.ObjectId;
  reference: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type VendorLedgerDocument = HydratedDocument<IVendorLedger>;
export type VendorLedgerModel = Model<IVendorLedger>;

const vendorLedgerSchema = new Schema<IVendorLedger, VendorLedgerModel>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    transactionType: {
      type: String,
      enum: [
        'order_earning',
        'payout_requested',
        'payout_processed',
        'payout_rejected',
        'payout_failed',
        'adjustment',
      ],
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative'],
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: [0, 'Balance after cannot be negative'],
    },
    parentOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    vendorOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'VendorOrder',
    },
    payoutId: {
      type: Schema.Types.ObjectId,
      ref: 'VendorPayout',
    },
    reference: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
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
        if (ret.vendorId && typeof ret.vendorId === 'object' && ret.vendorId.toString) {
          ret.vendorId = ret.vendorId.toString();
        }
        return ret;
      },
    },
  }
);

vendorLedgerSchema.index({ vendorId: 1, createdAt: -1 });

export const VendorLedger = model<IVendorLedger, VendorLedgerModel>(
  'VendorLedger',
  vendorLedgerSchema
);
