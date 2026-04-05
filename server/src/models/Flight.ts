import mongoose, { Schema, Document } from 'mongoose';

export interface IFlight extends Document {
  category: 'FLIGHT';
  providerName: string;
  origin: string;      // "San Diego (SAN)"
  destination: string; // "Tokyo (NRT)"
  basePrice: number;
  discountedPrice: number;
  inventory: number;
  startDate: Date;     // Departure Date
  endDate: Date;       // Return Date (if applicable)
  flightNumber: string;
  cabinClass: 'Economy' | 'Business' | 'First';
}

const FlightSchema: Schema = new Schema({
  category: { type: String, default: 'FLIGHT' },
  providerName: { type: String, required: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  basePrice: { type: Number, required: true },
  discountedPrice: { type: Number, required: true },
  inventory: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  flightNumber: { type: String, required: true },
  cabinClass: { type: String, enum: ['Economy', 'Business', 'First'], required: true }
}, { timestamps: true });

export default mongoose.model<IFlight>('Flight', FlightSchema);