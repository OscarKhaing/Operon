import mongoose, { Schema, Document } from 'mongoose';

export interface IHotel extends Document {
  category: 'HOTEL';
  providerName: string;
  location: string; // "San Diego, CA"
  basePrice: number;
  discountedPrice: number;
  inventory: number;
  startDate: Date;
  endDate: Date;
  roomType: string;
  amenities: string[];
  rating: number;
}

const HotelSchema: Schema = new Schema({
  category: { type: String, default: 'HOTEL' },
  providerName: { type: String, required: true },
  location: { type: String, required: true },
  basePrice: { type: Number, required: true },
  discountedPrice: { type: Number, required: true },
  inventory: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  roomType: { type: String, required: true },
  amenities: [{ type: String }],
  rating: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5,
    default: 3
  },
}, { timestamps: true });

export default mongoose.model<IHotel>('Hotel', HotelSchema);