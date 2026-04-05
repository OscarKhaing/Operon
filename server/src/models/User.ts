import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  insta_tag: string;
  fullName: string;
  birthday: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    insta_tag: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true, 
      trim: true 
    },
    fullName: { type: String, required: true },
    birthday: { type: Date, required: true },
  },
  { timestamps: true }
);

// Indexing the tag for lightning-fast lookups by the chatbot
UserSchema.index({ insta_tag: 1 });

const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
export default User;