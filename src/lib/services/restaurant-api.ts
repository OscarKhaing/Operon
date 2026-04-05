/**
 * Restaurant API client — fetches restaurant data from the Express/MongoDB backend
 * and transforms MongoDB documents into RestaurantRecord objects.
 */
import { RestaurantRecord } from "../types";

const API_URL = process.env.MONGODB_API_URL || "http://localhost:5001";
const TIMEOUT_MS = 5000;

// ─── MongoDB document shape ─────────────────────────────────────────────────

interface MongoRestaurantDoc {
  _id: string;
  category: string;
  providerName: string;
  location: string;
  cuisine: string;
  priceRange: string;
  amenities: string[];
  rating: number;
}

// ─── Transform helper ───────────────────────────────────────────────────────

function toRestaurantRecord(doc: MongoRestaurantDoc): RestaurantRecord {
  return {
    id: doc._id,
    name: doc.providerName,
    location: doc.location,
    cuisine: doc.cuisine,
    priceRange: doc.priceRange,
    rating: doc.rating,
    amenities: doc.amenities || [],
  };
}

// ─── Fetch with timeout ─────────────────────────────────────────────────────

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface RestaurantFetchParams {
  location?: string;
  cuisine?: string;
  priceRange?: string;
}

/**
 * Fetch restaurants from MongoDB via Express API, with optional filters.
 */
export async function fetchRestaurants(params?: RestaurantFetchParams): Promise<RestaurantRecord[]> {
  try {
    const query = new URLSearchParams();

    if (params?.location) query.set("location", params.location);
    if (params?.cuisine) query.set("cuisine", params.cuisine);
    if (params?.priceRange) query.set("priceRange", params.priceRange);

    const qs = query.toString();
    const url = `${API_URL}/api/restaurants${qs ? `?${qs}` : ""}`;

    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.error(`Restaurant API returned ${res.status}: ${await res.text()}`);
      return [];
    }

    const docs: MongoRestaurantDoc[] = await res.json();
    return docs.map(toRestaurantRecord);
  } catch (err) {
    console.error("Failed to fetch restaurants from MongoDB:", err);
    return [];
  }
}

/**
 * Fetch a single restaurant by MongoDB document ID.
 */
export async function fetchRestaurantById(restaurantId: string): Promise<RestaurantRecord | undefined> {
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/restaurants/${restaurantId}`);
    if (!res.ok) return undefined;

    const doc: MongoRestaurantDoc = await res.json();
    return toRestaurantRecord(doc);
  } catch (err) {
    console.error(`Failed to fetch restaurant ${restaurantId}:`, err);
    return undefined;
  }
}

// ─── Available locations (cached) ───────────────────────────────────────────

let locationCache: { locations: string[]; fetchedAt: number } | null = null;
const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all unique restaurant locations from MongoDB.
 */
export async function fetchAvailableRestaurantLocations(): Promise<string[]> {
  if (locationCache && Date.now() - locationCache.fetchedAt < LOCATION_CACHE_TTL_MS) {
    return locationCache.locations;
  }

  try {
    const res = await fetchWithTimeout(`${API_URL}/api/restaurants`);
    if (!res.ok) return locationCache?.locations || [];

    const docs: MongoRestaurantDoc[] = await res.json();
    const locations = [...new Set(docs.map((d) => d.location))].sort();

    locationCache = { locations, fetchedAt: Date.now() };
    return locations;
  } catch (err) {
    console.error("Failed to fetch available restaurant locations:", err);
    return locationCache?.locations || [];
  }
}
