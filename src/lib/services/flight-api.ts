/**
 * Flight API client — fetches flight data from the Express/MongoDB backend
 * and transforms MongoDB documents into FlightRecord objects.
 */
import { FlightRecord } from "../types";

const API_URL = process.env.MONGODB_API_URL || "http://localhost:5001";
const TIMEOUT_MS = 5000;

// ─── MongoDB document shape ─────────────────────────────────────────────────

interface MongoFlightDoc {
  _id: string;
  category: string;
  providerName: string;
  origin: string;
  destination: string;
  basePrice: number;
  discountedPrice: number;
  inventory: number;
  startDate: string;
  endDate: string;
  flightNumber: string;
  cabinClass: string;
}

// ─── Transform helper ───────────────────────────────────────────────────────

function toFlightRecord(doc: MongoFlightDoc): FlightRecord {
  return {
    id: doc._id,
    airline: doc.providerName,
    flightNumber: doc.flightNumber,
    origin: doc.origin,
    destination: doc.destination,
    departureDate: doc.startDate,
    returnDate: doc.endDate,
    cabinClass: doc.cabinClass,
    price: doc.discountedPrice,
    basePrice: doc.basePrice,
    inventory: doc.inventory,
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

export interface FlightFetchParams {
  origin?: string;
  destination?: string;
  startDate?: string;
  maxPrice?: number;
  cabinClass?: string;
  provider?: string;
}

/**
 * Fetch flights from MongoDB via Express API, with optional filters.
 */
export async function fetchFlights(params?: FlightFetchParams): Promise<FlightRecord[]> {
  try {
    const query = new URLSearchParams();

    if (params?.origin) query.set("origin", params.origin);
    if (params?.destination) query.set("destination", params.destination);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.maxPrice) query.set("maxPrice", String(params.maxPrice));
    if (params?.cabinClass) query.set("cabinClass", params.cabinClass);
    if (params?.provider) query.set("provider", params.provider);

    const qs = query.toString();
    const url = `${API_URL}/api/flights${qs ? `?${qs}` : ""}`;

    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.error(`Flight API returned ${res.status}: ${await res.text()}`);
      return [];
    }

    const docs: MongoFlightDoc[] = await res.json();
    return docs.map(toFlightRecord);
  } catch (err) {
    console.error("Failed to fetch flights from MongoDB:", err);
    return [];
  }
}

/**
 * Fetch a single flight by MongoDB document ID.
 */
export async function fetchFlightById(flightId: string): Promise<FlightRecord | undefined> {
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/flights`);
    if (!res.ok) return undefined;

    const docs: MongoFlightDoc[] = await res.json();
    const doc = docs.find((d) => d._id === flightId);
    return doc ? toFlightRecord(doc) : undefined;
  } catch (err) {
    console.error(`Failed to fetch flight ${flightId}:`, err);
    return undefined;
  }
}

// ─── Available routes (cached) ──────────────────────────────────────────────

let routeCache: { origins: string[]; destinations: string[]; fetchedAt: number } | null = null;
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all unique flight origins and destinations from MongoDB.
 */
export async function fetchAvailableRoutes(): Promise<{ origins: string[]; destinations: string[] }> {
  if (routeCache && Date.now() - routeCache.fetchedAt < ROUTE_CACHE_TTL_MS) {
    return { origins: routeCache.origins, destinations: routeCache.destinations };
  }

  try {
    const res = await fetchWithTimeout(`${API_URL}/api/flights`);
    if (!res.ok) return routeCache || { origins: [], destinations: [] };

    const docs: MongoFlightDoc[] = await res.json();
    const origins = [...new Set(docs.map((d) => d.origin))].sort();
    const destinations = [...new Set(docs.map((d) => d.destination))].sort();

    routeCache = { origins, destinations, fetchedAt: Date.now() };
    return { origins, destinations };
  } catch (err) {
    console.error("Failed to fetch available routes:", err);
    return routeCache || { origins: [], destinations: [] };
  }
}
