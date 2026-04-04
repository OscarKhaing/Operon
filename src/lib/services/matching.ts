/**
 * Hotel matching and ranking engine.
 * Filters hotels by constraints, ranks by price/location/preference fit.
 */
import { BookingRequest, HotelRecord, BookingOption, RoomType } from "../types";
import { store } from "../store";
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

  // Price within budget
  if (room.basePrice <= criteria.maxBudgetPerNight) {
    const savings = criteria.maxBudgetPerNight - room.basePrice;
    const savingsRatio = savings / criteria.maxBudgetPerNight;
    score += Math.round(savingsRatio * 25); // up to 25 points for value
    reasons.push(`$${room.basePrice}/night is within your $${criteria.maxBudgetPerNight} budget`);
  } else {
    const overageRatio = (room.basePrice - criteria.maxBudgetPerNight) / criteria.maxBudgetPerNight;
    score -= Math.round(overageRatio * 30);
    reasons.push(`$${room.basePrice}/night exceeds budget by $${room.basePrice - criteria.maxBudgetPerNight}`);
  }

  // Star rating bonus
  score += hotel.stars * 3;
  reasons.push(`${hotel.stars}-star property`);

  // Room type match
  const normalizedRoom = criteria.roomType.toLowerCase();
  const normalizedName = room.name.toLowerCase();
  if (normalizedName.includes(normalizedRoom)) {
    score += 15;
    reasons.push("Matches preferred room type");
  }

  // Guest capacity
  if (room.maxGuests >= criteria.guestCount) {
    score += 5;
  } else {
    score -= 20;
    reasons.push("May not accommodate all guests");
  }

  // Cap score
  score = Math.max(0, Math.min(100, score));

  return { score, explanation: reasons.join(". ") + "." };
}

export function findOptions(booking: BookingRequest): BookingOption[] {
  const hotels = store.getHotels();
  const nights = nightsBetween(booking.travel.checkIn, booking.travel.checkOut);

  const criteria: MatchCriteria = {
    destination: booking.travel.destination,
    roomType: booking.preferences.roomType,
    maxBudgetPerNight: booking.preferences.maxBudgetPerNight,
    guestCount: booking.travel.guestCount,
    checkIn: booking.travel.checkIn,
    checkOut: booking.travel.checkOut,
  };

  // Filter hotels by destination city
  const cityHotels = hotels.filter(
    (h) => h.city.toLowerCase() === criteria.destination.toLowerCase()
  );

  const options: BookingOption[] = [];

  for (const hotel of cityHotels) {
    for (const room of hotel.roomTypes) {
      const { score, explanation } = scoreOption(hotel, room, criteria);

      // Only include options that score above threshold or are close to budget
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

  return options;
}
