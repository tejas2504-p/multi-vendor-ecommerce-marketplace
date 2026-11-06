import { Schema, model, Model, Types, HydratedDocument } from 'mongoose';

export interface IVendorEarnings {
  _id?: Types.ObjectId;
  vendorId: Types.ObjectId;
  totalGrossSales: number;
  totalCommission: number;
  availableBalance: number;
  pendingBalance: number;
  paidOutAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type VendorEarningsDocument = HydratedDocument<IVendorEarnings>;
export type VendorEarningsModel = Model<IVendorEarnings>;

const vendorEarningsSchema = new Schema<IVendorEarnings, VendorEarningsModel>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    totalGrossSales: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Total gross sales cannot be negative'],
    },
    totalCommission: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Total commission cannot be negative'],
    },
    availableBalance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Available balance cannot be negative'],
    },
    pendingBalance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Pending balance cannot be negative'],
    },
    paidOutAmount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Paid out amount cannot be negative'],
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

export const VendorEarnings = model<IVendorEarnings, VendorEarningsModel>(
  'VendorEarnings',
  vendorEarningsSchema
);
