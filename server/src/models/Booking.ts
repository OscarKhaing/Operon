import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBooking extends Document {
  userId: mongoose.Types.ObjectId;
  itemId: mongoose.Types.ObjectId;   // Points to the Hotel or Flight ID
  itemModel: 'Hotel' | 'Flight';     // Tells Mongoose WHICH collection to look in
  userName: string;
  providerName: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: 'CONFIRMED' | 'CANCELLED';
}

const BookingSchema: Schema<IBooking> = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: Schema.Types.ObjectId, required: true, refPath: 'itemModel' },
    itemModel: { type: String, required: true, enum: ['Hotel', 'Flight'] },
    userName: { type: String, required: true },
    providerName: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalPrice: { type: Number, required: true },
    status: { type: String, enum: ['CONFIRMED', 'CANCELLED'], default: 'CONFIRMED' },
  },
  { timestamps: true }
);

const Booking: Model<IBooking> = mongoose.model<IBooking>('Booking', BookingSchema);
export default Booking;