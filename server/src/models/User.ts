import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  insta_tag: string;
  fullName: string;
  birthday: Date;
  passportNumber?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  // New: Previous Trip tracking
  previousTrip?: {
    destination: string;
    date: Date;
  };
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
    passportNumber: { type: String, trim: true },
    nationality: { type: String, trim: true },
    email: { 
      type: String, 
      lowercase: true, 
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'] 
    },
    phone: { type: String, trim: true },
    
    // New fields for travel history
    previousTrip: {
      destination: { type: String, trim: true },
      date: { type: Date }
    }
  },
  { timestamps: true }
);

// This check is essential for Next.js hot-reloading
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export default User;