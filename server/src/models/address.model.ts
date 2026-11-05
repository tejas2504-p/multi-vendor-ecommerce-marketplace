import { Schema, model, Model, Types, HydratedDocument } from 'mongoose';

export interface IAddress {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AddressDocument = HydratedDocument<IAddress>;
export type AddressModel = Model<IAddress>;

const addressSchema = new Schema<IAddress, AddressModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      minlength: [7, 'Phone number must be at least 7 characters'],
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
    },
    addressLine1: {
      type: String,
      required: [true, 'Address line 1 is required'],
      trim: true,
      minlength: [3, 'Address line 1 must be at least 3 characters'],
      maxlength: [150, 'Address line 1 cannot exceed 150 characters'],
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [150, 'Address line 2 cannot exceed 150 characters'],
      default: '',
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      minlength: [2, 'City must be at least 2 characters'],
      maxlength: [100, 'City cannot exceed 100 characters'],
    },
    state: {
      type: String,
      required: [true, 'State / Province / Region is required'],
      trim: true,
      minlength: [2, 'State must be at least 2 characters'],
      maxlength: [100, 'State cannot exceed 100 characters'],
    },
    postalCode: {
      type: String,
      required: [true, 'Postal / ZIP code is required'],
      trim: true,
      minlength: [3, 'Postal code must be at least 3 characters'],
      maxlength: [20, 'Postal code cannot exceed 20 characters'],
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      minlength: [2, 'Country must be at least 2 characters'],
      maxlength: [100, 'Country cannot exceed 100 characters'],
      default: 'United States',
    },
    isDefault: {
      type: Boolean,
      default: false,
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

// Compound index for querying user addresses with default first
addressSchema.index({ userId: 1, isDefault: -1, createdAt: -1 });

export const Address = model<IAddress, AddressModel>('Address', addressSchema);
