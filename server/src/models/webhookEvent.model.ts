import { Schema, model, Model, Types } from 'mongoose';

export interface IProcessedWebhookEvent {
  _id?: Types.ObjectId;
  eventId: string;
  eventType: string;
  processedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ProcessedWebhookEventModel = Model<IProcessedWebhookEvent>;

const processedWebhookEventSchema = new Schema<IProcessedWebhookEvent, ProcessedWebhookEventModel>(
  {
    eventId: {
      type: String,
      required: [true, 'Event ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      trim: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const ProcessedWebhookEvent = model<IProcessedWebhookEvent, ProcessedWebhookEventModel>(
  'ProcessedWebhookEvent',
  processedWebhookEventSchema
);

