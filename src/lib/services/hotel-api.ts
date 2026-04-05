/**
 * Hotel API client — fetches hotel data from the Express/MongoDB backend
 * and transforms flat MongoDB documents into nested HotelRecord objects.
 *
 * MongoDB Hotel schema (flat): one document = one room type at one hotel
 *   { providerName, location, basePrice, discountedPrice, inventory,
 *     startDate, endDate, roomType, amenities, rating, _id }
 *
 * Frontend HotelRecord (nested): one object = one hotel with multiple room types
 *   { id, name, location, city, stars, roomTypes: [...], ... }
 */
import { HotelRecord, RoomType } from "../types";

const API_URL = process.env.MONGODB_API_URL || "http://localhost:5001";
const TIMEOUT_MS = 5000;

// ─── MongoDB document shape ─────────────────────────────────────────────────

interface MongoHotelDoc {
  _id: string;
  category: string;
  providerName: string;
  location: string;
  basePrice: number;
  discountedPrice: number;
  inventory: number;
  startDate: string;
  endDate: string;
  roomType: string;
  amenities: string[];
  rating: number;
}

// ─── Transformation helpers ─────────────────────────────────────────────────

/**
 * Extract city from a location string like "Shinjuku, Tokyo" → "Tokyo"
 * or "Marina Bay, Singapore" → "Singapore".
 * Falls back to full string if no comma found.
 */
function extractCity(location: string): string {
  const parts = location.split(",");
  return (parts[parts.length - 1] || location).trim();
}

/**
 * Infer max guest capacity from room type name.
 */
function inferMaxGuests(roomType: string): number {
  const lower = roomType.toLowerCase();
  if (lower.includes("suite") || lower.includes("villa") || lower.includes("family")) return 4;
  if (lower.includes("deluxe") || lower.includes("superior") || lower.includes("ocean")) return 3;
  return 2; // standard, garden, etc.
}

/**
 * Group flat MongoDB hotel docs into nested HotelRecord objects.
 * Groups by providerName — all room types at the same hotel become one record.
 */
function groupByProvider(docs: MongoHotelDoc[]): HotelRecord[] {
  const groups = new Map<string, MongoHotelDoc[]>();

  for (const doc of docs) {
    const key = doc.providerName;
    const existing = groups.get(key);
    if (existing) {
      existing.push(doc);
    } else {
      groups.set(key, [doc]);
    }
  }

  return Array.from(groups.entries()).map(([providerName, groupDocs]) => {
    const first = groupDocs[0];
    const city = extractCity(first.location);

    const roomTypes: RoomType[] = groupDocs.map((d) => ({
      id: d._id,
      name: d.roomType,
      basePrice: d.discountedPrice,
      currency: "USD",
      maxGuests: inferMaxGuests(d.roomType),
      amenities: d.amenities || [],
    }));

    return {
      id: first._id,
      name: providerName,
      location: first.location,
      city,
      stars: Math.round(first.rating) || 3,
      contactEmail: "",
      contactPhone: "",
      roomTypes,
      templateId: "",
      tags: [],
    };
  });
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

export interface HotelFetchParams {
  location?: string;
  maxPrice?: number;
  minPrice?: number;
  checkIn?: string;
  checkOut?: string;
  minRating?: number;
  amenities?: string[];
}

/**
 * Fetch hotels from MongoDB via Express API, with optional filters.
 * Returns nested HotelRecord[] grouped by provider.
 */
export async function fetchHotels(params?: HotelFetchParams): Promise<HotelRecord[]> {
  try {
    const query = new URLSearchParams();

    if (params?.location) query.set("location", params.location);
    if (params?.maxPrice) query.set("maxPrice", String(params.maxPrice));
    if (params?.minPrice) query.set("minPrice", String(params.minPrice));
    if (params?.checkIn) query.set("checkIn", params.checkIn);
    if (params?.checkOut) query.set("checkOut", params.checkOut);
    if (params?.minRating) query.set("minRating", String(params.minRating));
    if (params?.amenities?.length) query.set("amenities", params.amenities.join(","));

    const qs = query.toString();
    const url = `${API_URL}/api/hotels${qs ? `?${qs}` : ""}`;

    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.error(`Hotel API returned ${res.status}: ${await res.text()}`);
      return [];
    }

    const docs: MongoHotelDoc[] = await res.json();
    return groupByProvider(docs);
  } catch (err) {
    console.error("Failed to fetch hotels from MongoDB:", err);
    return [];
  }
}

/**
 * Convenience: fetch hotels filtered by city/location.
 */
export async function fetchHotelsByCity(city: string): Promise<HotelRecord[]> {
  return fetchHotels({ location: city });
}

/**
 * Fetch a single hotel by MongoDB document ID.
 * Looks up the document, then fetches all room types for that provider.
 */
export async function fetchHotelById(hotelId: string): Promise<HotelRecord | undefined> {
  try {
    // First, fetch the specific document to get providerName
    const res = await fetchWithTimeout(`${API_URL}/api/hotels`);
    if (!res.ok) return undefined;

    const docs: MongoHotelDoc[] = await res.json();

    // Find the doc with matching _id to get providerName
    const targetDoc = docs.find((d) => d._id === hotelId);
    if (!targetDoc) return undefined;

    // Group all docs by provider and return the matching hotel
    const hotels = groupByProvider(docs);
    return hotels.find((h) => h.name === targetDoc.providerName);
  } catch (err) {
    console.error(`Failed to fetch hotel ${hotelId}:`, err);
    return undefined;
  }
}

// ─── Available locations (cached) ───────────────────────────────────────────

let locationCache: { locations: string[]; fetchedAt: number } | null = null;
const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all unique hotel locations from MongoDB.
 * Cached for 5 minutes since hotel inventory changes rarely.
 * Returns deduplicated location strings exactly as stored in the DB.
 */
export async function fetchAvailableLocations(): Promise<string[]> {
  if (locationCache && Date.now() - locationCache.fetchedAt < LOCATION_CACHE_TTL_MS) {
    return locationCache.locations;
  }

  try {
    const res = await fetchWithTimeout(`${API_URL}/api/hotels`);
    if (!res.ok) return locationCache?.locations || [];

    const docs: MongoHotelDoc[] = await res.json();
    const locations = [...new Set(docs.map((d) => d.location))].sort();

    locationCache = { locations, fetchedAt: Date.now() };
    return locations;
  } catch (err) {
    console.error("Failed to fetch available locations:", err);
    return locationCache?.locations || [];
  }
}
