import { Schema, model, Model, Types, HydratedDocument } from 'mongoose';
import { IOrderItemSnapshot } from './order.model';

export type VendorOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface IShipmentTracking {
  carrier?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
}

export interface IOrderStatusHistoryEntry {
  status: string;
  changedAt: Date;
  changedBy?: Types.ObjectId;
  note?: string;
}

export interface ICommissionSnapshot {
  grossAmount: number;
  commissionRate: number;
  platformFee: number;
  vendorEarnings: number;
  calculatedAt: Date;
}

export interface IVendorOrder {
  _id?: Types.ObjectId;
  parentOrderId: Types.ObjectId;
  vendorId: Types.ObjectId;
  vendorOrderNumber: string;
  items: IOrderItemSnapshot[];
  vendorSubtotal: number;
  shippingShare: number;
  discountShare?: number;
  discountAmount?: number;
  orderStatus: VendorOrderStatus;
  shipmentTracking?: IShipmentTracking;
  commission?: ICommissionSnapshot;
  cancellationReason?: string;
  cancelledAt?: Date;
  statusHistory: IOrderStatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export type VendorOrderDocument = HydratedDocument<IVendorOrder>;
export type VendorOrderModel = Model<IVendorOrder>;

const shipmentTrackingSchema = new Schema<IShipmentTracking>(
  {
    carrier: { type: String, trim: true },
    trackingNumber: { type: String, trim: true },
    estimatedDeliveryDate: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
  },
  { _id: false }
);

const commissionSnapshotSchema = new Schema<ICommissionSnapshot>(
  {
    grossAmount: { type: Number, required: true },
    commissionRate: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    vendorEarnings: { type: Number, required: true },
    calculatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const statusHistorySchema = new Schema<IOrderStatusHistoryEntry>(
  {
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const orderItemSnapshotSchema = new Schema<IOrderItemSnapshot>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    productImage: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative'],
    },
    itemSubtotal: {
      type: Number,
      required: true,
      min: [0, 'Item subtotal cannot be negative'],
    },
  },
  { _id: true }
);

const vendorOrderSchema = new Schema<IVendorOrder, VendorOrderModel>(
  {
    parentOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Parent order reference is required'],
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vendor reference is required'],
      index: true,
    },
    vendorOrderNumber: {
      type: String,
      required: [true, 'Vendor order number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    items: {
      type: [orderItemSnapshotSchema],
      required: [true, 'Vendor order items are required'],
      validate: {
        validator: (items: IOrderItemSnapshot[]) => items && items.length > 0,
        message: 'Vendor order must contain at least one item',
      },
    },
    vendorSubtotal: {
      type: Number,
      required: [true, 'Vendor subtotal is required'],
      min: [0, 'Vendor subtotal cannot be negative'],
    },
    shippingShare: {
      type: Number,
      default: 0,
      min: [0, 'Shipping share cannot be negative'],
    },
    discountShare: {
      type: Number,
      default: 0,
      min: [0, 'Discount share cannot be negative'],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative'],
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'confirmed',
    },
    shipmentTracking: {
      type: shipmentTrackingSchema,
      default: () => ({}),
    },
    commission: {
      type: commissionSnapshotSchema,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: () => [
        {
          status: 'confirmed',
          changedAt: new Date(),
          note: 'Vendor order initialized upon customer checkout',
        },
      ],
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
        if (ret.parentOrderId && typeof ret.parentOrderId === 'object' && ret.parentOrderId.toString) {
          ret.parentOrderId = ret.parentOrderId.toString();
        }
        if (ret.vendorId && typeof ret.vendorId === 'object' && ret.vendorId.toString) {
          ret.vendorId = ret.vendorId.toString();
        }
        return ret;
      },
    },
  }
);

// Query indexes
vendorOrderSchema.index({ vendorId: 1, createdAt: -1 });
vendorOrderSchema.index({ parentOrderId: 1, vendorId: 1 });
vendorOrderSchema.index({ orderStatus: 1 });

export const VendorOrder = model<IVendorOrder, VendorOrderModel>('VendorOrder', vendorOrderSchema);
