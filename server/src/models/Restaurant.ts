import mongoose, { Schema, Document } from 'mongoose';

export interface IRestaurant extends Document {
  category: string;           // "RESTAURANT"
  providerName: string;       // Restaurant Name
  location: string;           // UI: "Destination"
  cuisine: string;            // e.g., "Italian", "Sushi"
  priceRange: '10-20' | '20-30' | '30-50' | '50-100' | '100+'; // Price per person
  amenities: string[];        // ["Valet", "Vegan Options", "Outdoor Seating"]
  rating: number;             // 1-5 Scale
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema: Schema = new Schema(
  {
    category: { 
      type: String, 
      default: "RESTAURANT", 
      required: true 
    },
    providerName: { 
      type: String, 
      required: true 
    },
    location: { 
      type: String, 
      required: true 
    },
    cuisine: { 
      type: String, 
      required: true 
    },
    priceRange: { 
      type: String, 
      required: true, 
      enum: ['10-20', '20-30', '30-50', '50-100', '100+'] 
    },
    amenities: { 
      type: [String], 
      default: [] 
    },
    rating: { 
      type: Number, 
      default: 0, 
      min: 0, 
      max: 5 
    }
  },
  { 
    timestamps: true 
  }
);

RestaurantSchema.index({ location: 1, cuisine: 1 });

export default mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);