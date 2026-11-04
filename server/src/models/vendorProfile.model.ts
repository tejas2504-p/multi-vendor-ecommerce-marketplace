import { Schema, model, Model, Types } from 'mongoose';
import { slugify } from '../utils/slug';

export type VendorApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface IBusinessAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IVendorProfile {
  userId: Types.ObjectId;
  storeName: string;
  slug: string;
  description?: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: IBusinessAddress;
  status: VendorApplicationStatus;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type VendorProfileModel = Model<IVendorProfile>;

const businessAddressSchema = new Schema<IBusinessAddress>(
  {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
      maxlength: [120, 'Street address cannot exceed 120 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [60, 'City cannot exceed 60 characters'],
    },
    state: {
      type: String,
      required: [true, 'State or province is required'],
      trim: true,
      maxlength: [60, 'State cannot exceed 60 characters'],
    },
    postalCode: {
      type: String,
      required: [true, 'Postal / ZIP code is required'],
      trim: true,
      maxlength: [20, 'Postal code cannot exceed 20 characters'],
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      maxlength: [60, 'Country cannot exceed 60 characters'],
    },
  },
  { _id: false }
);

const vendorProfileSchema = new Schema<IVendorProfile, VendorProfileModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required'],
      unique: true,
      index: true,
    },
    storeName: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      minlength: [2, 'Store name must be at least 2 characters'],
      maxlength: [100, 'Store name cannot exceed 100 characters'],
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    businessEmail: {
      type: String,
      required: [true, 'Business email is required'],
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
        'Please provide a valid business email address',
      ],
    },
    businessPhone: {
      type: String,
      required: [true, 'Business phone is required'],
      trim: true,
      minlength: [5, 'Business phone must be at least 5 digits'],
      maxlength: [25, 'Business phone cannot exceed 25 characters'],
    },
    businessAddress: {
      type: businessAddressSchema,
      required: [true, 'Business address is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: 'Status must be either pending, approved, or rejected',
      },
      default: 'pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: undefined,
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

// Pre-validate hook: auto-generate slug from storeName if slug is not provided or changed
vendorProfileSchema.pre('validate', function (next) {
  if (this.isModified('storeName') || !this.slug) {
    this.slug = slugify(this.storeName);
  }
  next();
});

export const VendorProfile = model<IVendorProfile, VendorProfileModel>(
  'VendorProfile',
  vendorProfileSchema
);

