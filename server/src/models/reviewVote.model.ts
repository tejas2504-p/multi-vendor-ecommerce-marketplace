import { Schema, model, Model, Types, HydratedDocument } from 'mongoose';

export interface IReviewVote {
  _id?: Types.ObjectId;
  reviewId: Types.ObjectId;
  userId: Types.ObjectId;
  vote: 'helpful';
  createdAt: Date;
  updatedAt: Date;
}

export type ReviewVoteDocument = HydratedDocument<IReviewVote>;
export type ReviewVoteModel = Model<IReviewVote>;

const reviewVoteSchema = new Schema<IReviewVote, ReviewVoteModel>(
  {
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Review',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vote: {
      type: String,
      enum: ['helpful'],
      default: 'helpful',
      required: true,
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

// One vote per user per review
reviewVoteSchema.index({ reviewId: 1, userId: 1 }, { unique: true });

export const ReviewVote = model<IReviewVote, ReviewVoteModel>('ReviewVote', reviewVoteSchema);

