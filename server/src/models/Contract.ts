import mongoose, { Schema, Document, Model } from 'mongoose';

// 1. Define the TypeScript interface for a Contract
export interface IContract extends Document {
  category: 'HOTEL' | 'FLIGHT';
  providerName: string;
  location: string;
  basePrice: number;
  discountedPrice: number;
  inventory: number;
  startDate: Date;
  endDate: Date;
  details: Record<string, any>; // Flexible object for category-specific data
  createdAt: Date;
  updatedAt: Date;
}

// 2. Define the Mongoose Schema
const ContractSchema: Schema<IContract> = new Schema(
  {
    category: { 
      type: String, 
      enum: ['HOTEL', 'FLIGHT'], 
      required: true 
    },
    providerName: { type: String, required: true },
    location: { type: String, required: true },
    basePrice: { type: Number, required: true },
    discountedPrice: { type: Number, required: true },
    inventory: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    details: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

// 3. Add an index for faster searching in the Travel App
ContractSchema.index({ location: 'text', providerName: 'text' });

// 4. Export the Model
const Contract: Model<IContract> = mongoose.model<IContract>('Contract', ContractSchema);
export default Contract;