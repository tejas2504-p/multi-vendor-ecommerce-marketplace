import { Schema, model, Model, Types } from 'mongoose';

export type ProductStatus = 'draft' | 'active' | 'inactive';

/** Structured image metadata stored in MongoDB. The key is the stable S3 object key. */
export interface IProductImage {
  _id: Types.ObjectId;
  key: string;         // Stable S3 object key (e.g. products/vendorId/productId/uuid.jpg)
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

export interface IProduct {
  name: string;
  description: string;
  price: number;
  categoryId: Types.ObjectId;
  vendorId: Types.ObjectId;
  stock: number;
  images: IProductImage[];
  brand?: string;
  sku: string;
  status: ProductStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductModel = Model<IProduct>;

const productImageSchema = new Schema<IProductImage>(
  {
    key: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const productSchema = new Schema<IProduct, ProductModel>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      minlength: [10, 'Product description must be at least 10 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0.01, 'Price must be a positive number greater than zero'],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category reference is required'],
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vendor reference is required'],
      index: true,
    },
    stock: {
      type: Number,
      required: [true, 'Product stock count is required'],
      min: [0, 'Stock cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be an integer count',
      },
      default: 0,
    },
    images: {
      type: [productImageSchema],
      default: [],
    },
    brand: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Brand name cannot exceed 100 characters'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'active', 'inactive'],
        message: 'Status must be draft, active, or inactive',
      },
      default: 'active',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
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
        return ret;
      },
    },
  }
);

// Indexes for query performance
productSchema.index({ vendorId: 1, isDeleted: 1 });
productSchema.index({ categoryId: 1, status: 1, isDeleted: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ name: 'text', brand: 'text', description: 'text' });

export const Product = model<IProduct, ProductModel>('Product', productSchema);

