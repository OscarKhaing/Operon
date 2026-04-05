/**
 * Seed script for flight data.
 * Run: npx ts-node seed-flights.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const FlightSchema = new mongoose.Schema({
  category: { type: String, default: "FLIGHT" },
  providerName: { type: String, required: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  basePrice: { type: Number, required: true },
  discountedPrice: { type: Number, required: true },
  inventory: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  flightNumber: { type: String, required: true },
  cabinClass: { type: String, enum: ["Economy", "Premium Economy", "Business", "First"], required: true },
}, { timestamps: true });

const Flight = mongoose.model("Flight", FlightSchema);

const flights = [
  // SAN → NRT (San Diego to Tokyo)
  { providerName: "Japan Airlines", origin: "San Diego (SAN)", destination: "Tokyo (NRT)", basePrice: 650, discountedPrice: 580, inventory: 30, startDate: "2026-05-01", endDate: "2026-05-15", flightNumber: "JL7075", cabinClass: "Economy" },
  { providerName: "Japan Airlines", origin: "San Diego (SAN)", destination: "Tokyo (NRT)", basePrice: 2800, discountedPrice: 2400, inventory: 8, startDate: "2026-05-01", endDate: "2026-05-15", flightNumber: "JL7075", cabinClass: "Business" },
  { providerName: "ANA", origin: "San Diego (SAN)", destination: "Tokyo (NRT)", basePrice: 720, discountedPrice: 620, inventory: 25, startDate: "2026-05-10", endDate: "2026-05-25", flightNumber: "NH7021", cabinClass: "Economy" },
  { providerName: "ANA", origin: "San Diego (SAN)", destination: "Tokyo (NRT)", basePrice: 5500, discountedPrice: 4800, inventory: 4, startDate: "2026-05-10", endDate: "2026-05-25", flightNumber: "NH7021", cabinClass: "First" },
  { providerName: "United", origin: "San Diego (SAN)", destination: "Tokyo (NRT)", basePrice: 580, discountedPrice: 520, inventory: 40, startDate: "2026-06-01", endDate: "2026-06-15", flightNumber: "UA838", cabinClass: "Economy" },

  // SAN → SIN (San Diego to Singapore)
  { providerName: "Singapore Airlines", origin: "San Diego (SAN)", destination: "Singapore (SIN)", basePrice: 850, discountedPrice: 780, inventory: 20, startDate: "2026-05-05", endDate: "2026-05-20", flightNumber: "SQ37", cabinClass: "Economy" },
  { providerName: "Singapore Airlines", origin: "San Diego (SAN)", destination: "Singapore (SIN)", basePrice: 3200, discountedPrice: 2900, inventory: 6, startDate: "2026-05-05", endDate: "2026-05-20", flightNumber: "SQ37", cabinClass: "Business" },

  // LAX → LHR (Los Angeles to London)
  { providerName: "British Airways", origin: "Los Angeles (LAX)", destination: "London (LHR)", basePrice: 750, discountedPrice: 680, inventory: 35, startDate: "2026-05-15", endDate: "2026-06-01", flightNumber: "BA282", cabinClass: "Economy" },
  { providerName: "British Airways", origin: "Los Angeles (LAX)", destination: "London (LHR)", basePrice: 1400, discountedPrice: 1200, inventory: 12, startDate: "2026-05-15", endDate: "2026-06-01", flightNumber: "BA282", cabinClass: "Premium Economy" },
  { providerName: "British Airways", origin: "Los Angeles (LAX)", destination: "London (LHR)", basePrice: 4500, discountedPrice: 3800, inventory: 5, startDate: "2026-05-15", endDate: "2026-06-01", flightNumber: "BA282", cabinClass: "Business" },

  // SFO → ICN (San Francisco to Seoul)
  { providerName: "Korean Air", origin: "San Francisco (SFO)", destination: "Seoul (ICN)", basePrice: 700, discountedPrice: 620, inventory: 28, startDate: "2026-06-01", endDate: "2026-06-20", flightNumber: "KE24", cabinClass: "Economy" },
  { providerName: "Korean Air", origin: "San Francisco (SFO)", destination: "Seoul (ICN)", basePrice: 2600, discountedPrice: 2200, inventory: 8, startDate: "2026-06-01", endDate: "2026-06-20", flightNumber: "KE24", cabinClass: "Business" },

  // LAX → BKK (Los Angeles to Bangkok)
  { providerName: "Thai Airways", origin: "Los Angeles (LAX)", destination: "Bangkok (BKK)", basePrice: 680, discountedPrice: 600, inventory: 32, startDate: "2026-05-20", endDate: "2026-06-10", flightNumber: "TG507", cabinClass: "Economy" },
  { providerName: "Thai Airways", origin: "Los Angeles (LAX)", destination: "Bangkok (BKK)", basePrice: 2400, discountedPrice: 2100, inventory: 10, startDate: "2026-05-20", endDate: "2026-06-10", flightNumber: "TG507", cabinClass: "Business" },

  // JFK → CDG (New York to Paris)
  { providerName: "United", origin: "New York (JFK)", destination: "Paris (CDG)", basePrice: 620, discountedPrice: 550, inventory: 45, startDate: "2026-06-10", endDate: "2026-07-01", flightNumber: "UA57", cabinClass: "Economy" },
  { providerName: "United", origin: "New York (JFK)", destination: "Paris (CDG)", basePrice: 3000, discountedPrice: 2600, inventory: 6, startDate: "2026-06-10", endDate: "2026-07-01", flightNumber: "UA57", cabinClass: "Business" },

  // JFK → SIN (New York to Singapore)
  { providerName: "Singapore Airlines", origin: "New York (JFK)", destination: "Singapore (SIN)", basePrice: 900, discountedPrice: 820, inventory: 18, startDate: "2026-06-15", endDate: "2026-07-05", flightNumber: "SQ23", cabinClass: "Economy" },
  { providerName: "Singapore Airlines", origin: "New York (JFK)", destination: "Singapore (SIN)", basePrice: 6000, discountedPrice: 5200, inventory: 3, startDate: "2026-06-15", endDate: "2026-07-05", flightNumber: "SQ23", cabinClass: "First" },

  // SFO → HND (San Francisco to Tokyo Haneda)
  { providerName: "ANA", origin: "San Francisco (SFO)", destination: "Tokyo (HND)", basePrice: 780, discountedPrice: 700, inventory: 22, startDate: "2026-05-25", endDate: "2026-06-15", flightNumber: "NH107", cabinClass: "Economy" },
  { providerName: "ANA", origin: "San Francisco (SFO)", destination: "Tokyo (HND)", basePrice: 3400, discountedPrice: 3000, inventory: 5, startDate: "2026-05-25", endDate: "2026-06-15", flightNumber: "NH107", cabinClass: "Business" },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI!);
  console.log("Connected to MongoDB");

  await Flight.deleteMany({});
  console.log("Cleared existing flights");

  const result = await Flight.insertMany(flights);
  console.log(`Inserted ${result.length} flights`);

  await mongoose.disconnect();
  console.log("Done!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
