import { Schema, model, Model, Types } from 'mongoose';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'partially_shipped'
  | 'partially_delivered'
  | 'delivered'
  | 'cancelled';

export interface IDeliveryAddressSnapshot {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IOrderItemSnapshot {
  _id?: Types.ObjectId;
  productId: Types.ObjectId;
  vendorId: Types.ObjectId;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  itemSubtotal: number;
}

export interface ICouponSnapshot {
  couponId: Types.ObjectId;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
}

export interface IOrder {
  _id?: Types.ObjectId;
  orderNumber: string;
  userId: Types.ObjectId;
  customerId?: Types.ObjectId;
  deliveryAddress: IDeliveryAddressSnapshot;
  vendorOrders?: Types.ObjectId[];
  items: IOrderItemSnapshot[];
  subtotal: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  couponCode?: string;
  couponSnapshot?: ICouponSnapshot;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderModel = Model<IOrder>;

const deliveryAddressSnapshotSchema = new Schema<IDeliveryAddressSnapshot>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true, default: '' },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
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

const orderSchema = new Schema<IOrder, OrderModel>(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    deliveryAddress: {
      type: deliveryAddressSnapshotSchema,
      required: [true, 'Delivery address snapshot is required'],
    },
    vendorOrders: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'VendorOrder',
        },
      ],
      default: [],
    },
    items: {
      type: [orderItemSnapshotSchema],
      required: [true, 'Order items are required'],
      validate: {
        validator: (items: IOrderItemSnapshot[]) => items && items.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    shippingAmount: {
      type: Number,
      required: [true, 'Shipping amount is required'],
      min: [0, 'Shipping amount cannot be negative'],
      default: 0,
    },
    discountAmount: {
      type: Number,
      required: [true, 'Discount amount is required'],
      min: [0, 'Discount amount cannot be negative'],
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    couponSnapshot: {
      couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
      code: { type: String, trim: true, uppercase: true },
      discountType: { type: String, enum: ['percentage', 'fixed'] },
      discountValue: { type: Number },
      discountAmount: { type: Number, default: 0 },
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    orderStatus: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'partially_shipped',
        'partially_delivered',
        'delivered',
        'cancelled',
      ],
      default: 'confirmed',
      index: true,
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
        if (ret.userId && typeof ret.userId === 'object' && ret.userId.toString) {
          ret.userId = ret.userId.toString();
        }
        return ret;
      },
    },
  }
);

// Query indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ 'items.vendorId': 1, createdAt: -1 });
orderSchema.index({ 'items.productId': 1 });

export const Order = model<IOrder, OrderModel>('Order', orderSchema);

