/**
 * Hotel matching and ranking engine.
 * Fetches hotels from MongoDB via the hotel API, then scores and ranks options.
 */
import { BookingRequest, HotelRecord, BookingOption, RoomType } from "../types";
import { fetchHotels } from "./hotel-api";
import { v4 as uuid } from "uuid";

interface MatchCriteria {
  destination: string;
  roomType: string;
  maxBudgetPerNight: number;
  guestCount: number;
  checkIn: string;
  checkOut: string;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const d1 = new Date(checkIn);
  const d2 = new Date(checkOut);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function scoreOption(
  hotel: HotelRecord,
  room: RoomType,
  criteria: MatchCriteria
): { score: number; explanation: string } {
  let score = 50; // base score
  const reasons: string[] = [];

  // Price within budget (skip if no budget specified)
  if (criteria.maxBudgetPerNight > 0) {
    if (room.basePrice <= criteria.maxBudgetPerNight) {
      const savings = criteria.maxBudgetPerNight - room.basePrice;
      const savingsRatio = savings / criteria.maxBudgetPerNight;
      score += Math.round(savingsRatio * 25);
      reasons.push(`$${room.basePrice}/night is within your $${criteria.maxBudgetPerNight} budget`);
    } else {
      const overageRatio = (room.basePrice - criteria.maxBudgetPerNight) / criteria.maxBudgetPerNight;
      score -= Math.round(overageRatio * 30);
      reasons.push(`$${room.basePrice}/night exceeds budget by $${room.basePrice - criteria.maxBudgetPerNight}`);
    }
  } else {
    reasons.push(`$${room.basePrice}/night`);
  }

  // Star rating bonus
  score += hotel.stars * 3;
  reasons.push(`${hotel.stars}-star property`);

  // Room type match (skip if no preference — "any" or unspecified)
  if (criteria.roomType) {
    const normalizedRoom = criteria.roomType.toLowerCase();
    const normalizedName = room.name.toLowerCase();
    if (normalizedName.includes(normalizedRoom)) {
      score += 15;
      reasons.push("Matches preferred room type");
    }
  }

  // Guest capacity (skip penalty if not specified, default assumes 2)
  if (criteria.guestCount > 0) {
    if (room.maxGuests >= criteria.guestCount) {
      score += 5;
    } else {
      score -= 20;
      reasons.push("May not accommodate all guests");
    }
  } else {
    score += 5; // no preference = all rooms valid
  }

  // Cap score
  score = Math.max(0, Math.min(100, score));

  return { score, explanation: reasons.join(". ") + "." };
}

export interface MatchResult {
  options: BookingOption[];
  hotelMap: Map<string, HotelRecord>;
}

/**
 * Find and rank hotel options for a booking.
 * Fetches from MongoDB with pre-filters, then scores locally.
 */
export async function findOptions(
  booking: BookingRequest,
  cachedHotels?: HotelRecord[],
): Promise<MatchResult> {
  const nights = nightsBetween(booking.travel.checkIn, booking.travel.checkOut);

  const criteria: MatchCriteria = {
    destination: booking.travel.destination,
    roomType: booking.preferences.roomType,
    maxBudgetPerNight: booking.preferences.maxBudgetPerNight,
    guestCount: booking.travel.guestCount,
    checkIn: booking.travel.checkIn,
    checkOut: booking.travel.checkOut,
  };

  // Use cached hotels if available (pre-loaded when destination was set).
  // Otherwise fall back to fetching from MongoDB with filters.
  let hotels: HotelRecord[];
  if (cachedHotels && cachedHotels.length > 0) {
    hotels = cachedHotels;
  } else {
    const fetchParams: Parameters<typeof fetchHotels>[0] = {};
    if (criteria.destination) fetchParams.location = criteria.destination;
    if (criteria.maxBudgetPerNight > 0) fetchParams.maxPrice = Math.round(criteria.maxBudgetPerNight * 1.5);
    if (criteria.checkIn) fetchParams.checkIn = criteria.checkIn;
    if (criteria.checkOut) fetchParams.checkOut = criteria.checkOut;
    hotels = await fetchHotels(fetchParams);
  }

  // Build hotel lookup map for callers (stars, contactEmail, etc.)
  const hotelMap = new Map<string, HotelRecord>();
  for (const hotel of hotels) {
    hotelMap.set(hotel.id, hotel);
    // Also index by name for lookup flexibility
    hotelMap.set(hotel.name, hotel);
  }

  const options: BookingOption[] = [];

  for (const hotel of hotels) {
    for (const room of hotel.roomTypes) {
      const { score, explanation } = scoreOption(hotel, room, criteria);

      if (score >= 30) {
        options.push({
          id: uuid(),
          bookingId: booking.id,
          hotelId: hotel.id,
          hotelName: hotel.name,
          roomType: room,
          totalPrice: room.basePrice * nights,
          nightCount: nights,
          score,
          explanation,
        });
      }
    }
  }

  // Sort by score descending
  options.sort((a, b) => b.score - a.score);

  return { options, hotelMap };
}
