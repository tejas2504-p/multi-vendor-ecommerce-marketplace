import { Schema, model, Model, Types, HydratedDocument } from 'mongoose';
import { IDeliveryAddressSnapshot } from './order.model';

export type InvoiceType = 'customer_parent' | 'vendor_order';

export interface IIssuerDetailsSnapshot {
  name: string;
  address: string;
  taxId?: string;
  email?: string;
  phone?: string;
}

export interface ICustomerDetailsSnapshot {
  name: string;
  email: string;
  phone?: string;
}

export interface IInvoiceItemSnapshot {
  productId: Types.ObjectId;
  vendorId?: Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: number;
  itemSubtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discountAmount?: number;
}

export interface ITaxBreakdown {
  totalTax: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  rate?: number;
  notes?: string;
}

export interface IInvoice {
  _id?: Types.ObjectId;
  invoiceNumber: string;
  parentOrderId: Types.ObjectId;
  vendorOrderId?: Types.ObjectId;
  customerId: Types.ObjectId;
  vendorId?: Types.ObjectId;
  invoiceType: InvoiceType;
  issuerDetails: IIssuerDetailsSnapshot;
  customerDetails: ICustomerDetailsSnapshot;
  billingAddress: IDeliveryAddressSnapshot;
  shippingAddress: IDeliveryAddressSnapshot;
  items: IInvoiceItemSnapshot[];
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxBreakdown: ITaxBreakdown;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  invoiceDate: Date;
  pdfStorageKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceDocument = HydratedDocument<IInvoice>;
export type InvoiceModel = Model<IInvoice>;

const issuerDetailsSchema = new Schema<IIssuerDetailsSnapshot>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    taxId: { type: String, trim: true, default: 'N/A' },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false }
);

const customerDetailsSchema = new Schema<ICustomerDetailsSnapshot>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const addressSnapshotSchema = new Schema<IDeliveryAddressSnapshot>(
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

const invoiceItemSnapshotSchema = new Schema<IInvoiceItemSnapshot>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    productName: {
      type: String,
      required: true,
      trim: true,
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
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative'],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative'],
    },
  },
  { _id: false }
);

const taxBreakdownSchema = new Schema<ITaxBreakdown>(
  {
    totalTax: { type: Number, required: true, default: 0, min: 0 },
    cgst: { type: Number, default: 0, min: 0 },
    sgst: { type: Number, default: 0, min: 0 },
    igst: { type: Number, default: 0, min: 0 },
    rate: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice, InvoiceModel>(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    parentOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Parent order reference is required'],
      index: true,
    },
    vendorOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'VendorOrder',
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    invoiceType: {
      type: String,
      enum: ['customer_parent', 'vendor_order'],
      required: true,
      default: 'customer_parent',
      index: true,
    },
    issuerDetails: {
      type: issuerDetailsSchema,
      required: [true, 'Issuer details snapshot is required'],
    },
    customerDetails: {
      type: customerDetailsSchema,
      required: [true, 'Customer details snapshot is required'],
    },
    billingAddress: {
      type: addressSnapshotSchema,
      required: [true, 'Billing address snapshot is required'],
    },
    shippingAddress: {
      type: addressSnapshotSchema,
      required: [true, 'Shipping address snapshot is required'],
    },
    items: {
      type: [invoiceItemSnapshotSchema],
      required: [true, 'Invoice must contain at least one item'],
      validate: {
        validator: (items: IInvoiceItemSnapshot[]) => items && items.length > 0,
        message: 'Invoice must contain at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative'],
    },
    shippingAmount: {
      type: Number,
      default: 0,
      min: [0, 'Shipping amount cannot be negative'],
    },
    taxBreakdown: {
      type: taxBreakdownSchema,
      default: () => ({ totalTax: 0, cgst: 0, sgst: 0, igst: 0, rate: 0 }),
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    paymentStatus: {
      type: String,
      required: true,
      default: 'paid',
      trim: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    pdfStorageKey: {
      type: String,
      required: [true, 'PDF storage key is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal querying and uniqueness guarantees
invoiceSchema.index({ parentOrderId: 1, invoiceType: 1 });
invoiceSchema.index({ parentOrderId: 1, vendorOrderId: 1, invoiceType: 1 });
invoiceSchema.index({ customerId: 1, createdAt: -1 });
invoiceSchema.index({ vendorId: 1, createdAt: -1 });

export const Invoice = model<IInvoice, InvoiceModel>('Invoice', invoiceSchema);

