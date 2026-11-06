import { Schema, model, Model, Types } from 'mongoose';

export interface IPlatformSetting {
  _id?: Types.ObjectId;
  key: string;
  value: any;
  description?: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type PlatformSettingModel = Model<IPlatformSetting>;

const platformSettingSchema = new Schema<IPlatformSetting, PlatformSettingModel>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export const PlatformSetting = model<IPlatformSetting, PlatformSettingModel>(
  'PlatformSetting',
  platformSettingSchema
);
