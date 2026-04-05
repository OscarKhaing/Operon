/**
 * Seed script for restaurant data.
 * Run: npx ts-node seed-restaurants.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const RestaurantSchema = new mongoose.Schema({
  category: { type: String, default: "RESTAURANT", required: true },
  providerName: { type: String, required: true },
  location: { type: String, required: true },
  cuisine: { type: String, required: true },
  priceRange: { type: String, required: true, enum: ["10-20", "20-30", "30-50", "50-100", "100+"] },
  amenities: { type: [String], default: [] },
  rating: { type: Number, default: 0, min: 0, max: 5 },
}, { timestamps: true });

const Restaurant = mongoose.model("Restaurant", RestaurantSchema);

const restaurants = [
  // San Diego
  { providerName: "Casa de Mariscos", location: "San Diego, CA", cuisine: "Mexican Seafood", priceRange: "30-50", amenities: ["Outdoor Seating", "Ocean View", "Full Bar", "Live Music"], rating: 4.5 },
  { providerName: "Gaslamp Italian Kitchen", location: "San Diego, CA", cuisine: "Italian", priceRange: "50-100", amenities: ["Wine List", "Private Dining", "Valet"], rating: 4.3 },
  { providerName: "Pacific Beach Tacos", location: "San Diego, CA", cuisine: "Mexican", priceRange: "10-20", amenities: ["Outdoor Seating", "Vegan Options", "Casual"], rating: 4.0 },

  // Tokyo
  { providerName: "Sushi Dai", location: "Tsukiji, Tokyo", cuisine: "Sushi", priceRange: "50-100", amenities: ["Counter Seating", "Omakase", "Fresh Market Fish"], rating: 4.8 },
  { providerName: "Ichiran Shibuya", location: "Shibuya, Tokyo", cuisine: "Ramen", priceRange: "10-20", amenities: ["Solo Dining", "Late Night", "Vegan Options"], rating: 4.2 },
  { providerName: "Ukai Tei", location: "Ginza, Tokyo", cuisine: "Teppanyaki", priceRange: "100+", amenities: ["Private Dining", "Wine List", "Wagyu Beef", "City View"], rating: 4.9 },

  // Singapore
  { providerName: "Lau Pa Sat Hawker", location: "Marina Bay, Singapore", cuisine: "Hawker", priceRange: "10-20", amenities: ["Outdoor Seating", "Late Night", "Satay Street"], rating: 4.1 },
  { providerName: "Jade Palace", location: "Orchard, Singapore", cuisine: "Chinese", priceRange: "50-100", amenities: ["Dim Sum", "Private Dining", "Wine List"], rating: 4.6 },
  { providerName: "Blue Ginger", location: "Tanjong Pagar, Singapore", cuisine: "Peranakan", priceRange: "30-50", amenities: ["Heritage Setting", "Vegetarian Options", "Wine List"], rating: 4.4 },

  // Seoul
  { providerName: "Maple Tree House", location: "Gangnam, Seoul", cuisine: "Korean BBQ", priceRange: "30-50", amenities: ["Private Rooms", "Premium Beef", "Full Bar"], rating: 4.5 },
  { providerName: "Jungsik", location: "Gangnam, Seoul", cuisine: "Modern Korean", priceRange: "100+", amenities: ["Tasting Menu", "Wine Pairing", "Private Dining", "Michelin Star"], rating: 4.8 },

  // Shanghai
  { providerName: "Din Tai Fung", location: "Xintiandi, Shanghai", cuisine: "Chinese", priceRange: "20-30", amenities: ["Family Friendly", "Xiao Long Bao", "Open Kitchen"], rating: 4.3 },
  { providerName: "Mr & Mrs Bund", location: "The Bund, Shanghai", cuisine: "French", priceRange: "100+", amenities: ["River View", "Wine List", "Private Dining", "Terrace"], rating: 4.7 },

  // London
  { providerName: "Dishoom King's Cross", location: "King's Cross, London", cuisine: "Indian", priceRange: "20-30", amenities: ["Breakfast", "Cocktail Bar", "Vegetarian Options", "Group Dining"], rating: 4.5 },
  { providerName: "The Ledbury", location: "Notting Hill, London", cuisine: "French", priceRange: "100+", amenities: ["Tasting Menu", "Wine Pairing", "Michelin Star", "Garden"], rating: 4.9 },
  { providerName: "Flat Iron Soho", location: "Soho, London", cuisine: "Steakhouse", priceRange: "20-30", amenities: ["Casual", "No Reservations", "Dessert Included"], rating: 4.1 },

  // Bangkok
  { providerName: "Gaggan Anand", location: "Lumphini, Bangkok", cuisine: "Progressive Indian", priceRange: "100+", amenities: ["Tasting Menu", "Wine Pairing", "Chef's Table"], rating: 4.9 },
  { providerName: "Jay Fai", location: "Old Town, Bangkok", cuisine: "Thai Street Food", priceRange: "30-50", amenities: ["Street Food", "Crab Omelette", "Michelin Star"], rating: 4.7 },

  // Phuket
  { providerName: "Blue Elephant Phuket", location: "Old Town, Phuket", cuisine: "Thai", priceRange: "50-100", amenities: ["Colonial Setting", "Cooking Class", "Garden Dining", "Wine List"], rating: 4.5 },
  { providerName: "Kata Rocks", location: "Kata, Phuket", cuisine: "Mediterranean", priceRange: "50-100", amenities: ["Ocean View", "Infinity Pool", "Cocktail Bar", "Sunset Dining"], rating: 4.6 },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI!);
  console.log("Connected to MongoDB");

  await Restaurant.deleteMany({});
  console.log("Cleared existing restaurants");

  const result = await Restaurant.insertMany(restaurants);
  console.log(`Inserted ${result.length} restaurants`);

  await mongoose.disconnect();
  console.log("Done!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
