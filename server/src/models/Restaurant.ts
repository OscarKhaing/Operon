import mongoose, { Schema, Document } from 'mongoose';

export interface IRestaurant extends Document {
  category: string;           // "RESTAURANT"
  providerName: string;       // Restaurant Name
  location: string;           // UI: "Destination"
  cuisine: string;            // e.g., "Italian", "Sushi"
  amenities: string[];        // ["Valet", "Vegan Options", "Outdoor Seating"]
  rating: number;             // 1-5 Scale
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema: Schema = new Schema(
  {
    category: { type: String, default: 'RESTAURANT' },
    providerName: { type: String, required: true },
    location: { type: String, required: true },
    cuisine: { type: String, required: true },
    amenities: { type: [String], default: [] },
    rating: { type: Number, default: 4 }
  },
  { timestamps: true }
);

export default mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);