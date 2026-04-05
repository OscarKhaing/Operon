import mongoose, { Schema, Document } from 'mongoose';

export interface IBooking extends Document {
  userId: mongoose.Types.ObjectId;
  itemId: mongoose.Types.ObjectId;
  itemModel: 'Flight' | 'Hotel' | 'Restaurant';
  customerName: string;      // UI Column: "Customer"
  destination: string;       // UI Column: "Destination"
  status: 'intake' | 'extracting' | 'options presented' | 'sent to hotel' | 'confirmed' | 'cancelled';
  budget: number;            // UI Column: "Budget"
  guests: number;            // UI Column: "Guests"
  notes?: string;            // UI Column: "Extra Details"
  providerName: string;      // Internal: Airline/Hotel name
  createdAt: Date;           // Internal/UI: Can be used for "Time Elapsed"
}

const BookingSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: Schema.Types.ObjectId, required: true, refPath: 'itemModel' },
    itemModel: { type: String, required: true, enum: ['Flight', 'Hotel', 'Restaurant'] },
    customerName: { type: String, required: true },
    destination: { type: String, required: true },
    budget: { type: Number, required: true },
    guests: { type: Number, default: 1 },
    notes: { type: String, default: "" },
    status: { 
      type: String, 
      required: true, 
      default: 'intake',
      enum: ['intake', 'extracting', 'options presented', 'sent to hotel', 'confirmed', 'cancelled']
    },
    providerName: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model<IBooking>('Booking', BookingSchema);