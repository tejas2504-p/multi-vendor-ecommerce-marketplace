import { Schema, model, Model, Types } from 'mongoose';

export type SyncAction = 'INDEX' | 'DELETE';
export type SyncStatus = 'PENDING' | 'PROCESSED' | 'FAILED';

export interface IProductSyncOutbox {
  productId: Types.ObjectId;
  action: SyncAction;
  status: SyncStatus;
  attempts: number;
  lastError?: string;
  nextRetryAt: Date;
  payload?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductSyncOutboxModel = Model<IProductSyncOutbox>;

const productSyncOutboxSchema = new Schema<IProductSyncOutbox, ProductSyncOutboxModel>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['INDEX', 'DELETE'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
    },
    nextRetryAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

productSyncOutboxSchema.index({ status: 1, nextRetryAt: 1 });

export const ProductSyncOutbox = model<IProductSyncOutbox, ProductSyncOutboxModel>(
  'ProductSyncOutbox',
  productSyncOutboxSchema
);

