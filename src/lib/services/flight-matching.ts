/**
 * Flight matching and ranking engine.
 * Fetches flights from MongoDB via the flight API, then scores and ranks options.
 */
import { BookingRequest, FlightRecord, FlightBookingOption } from "../types";
import { fetchFlights } from "./flight-api";
import { v4 as uuid } from "uuid";

interface FlightMatchCriteria {
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass: string;
  maxBudget: number;
  passengers: number;
}

function scoreFlightOption(
  flight: FlightRecord,
  criteria: FlightMatchCriteria
): { score: number; explanation: string } {
  let score = 50; // base score
  const reasons: string[] = [];

  // Price within budget (skip if no budget specified)
  if (criteria.maxBudget > 0) {
    if (flight.price <= criteria.maxBudget) {
      const savings = criteria.maxBudget - flight.price;
      const savingsRatio = savings / criteria.maxBudget;
      score += Math.round(savingsRatio * 25);
      reasons.push(`$${flight.price} is within your $${criteria.maxBudget} budget`);
    } else {
      const overageRatio = (flight.price - criteria.maxBudget) / criteria.maxBudget;
      score -= Math.round(overageRatio * 30);
      reasons.push(`$${flight.price} exceeds budget by $${flight.price - criteria.maxBudget}`);
    }
  } else {
    reasons.push(`$${flight.price} per person`);
  }

  // Cabin class match
  if (criteria.cabinClass) {
    if (flight.cabinClass.toLowerCase() === criteria.cabinClass.toLowerCase()) {
      score += 15;
      reasons.push("Matches preferred cabin class");
    }
  }

  // Inventory check — enough seats for all passengers
  if (criteria.passengers > 0) {
    if (flight.inventory >= criteria.passengers) {
      score += 5;
    } else {
      score -= 20;
      reasons.push("Limited seat availability");
    }
  } else {
    score += 5;
  }

  // Cap score
  score = Math.max(0, Math.min(100, score));

  return { score, explanation: reasons.join(". ") + "." };
}

export interface FlightMatchResult {
  options: FlightBookingOption[];
  flightMap: Map<string, FlightRecord>;
}

/**
 * Find and rank flight options for a booking.
 */
export async function findFlightOptions(
  booking: BookingRequest,
  cachedFlights?: FlightRecord[],
): Promise<FlightMatchResult> {
  const fd = booking.flightDetails;

  const criteria: FlightMatchCriteria = {
    origin: fd?.origin || "",
    destination: fd?.destination || booking.travel.destination,
    departureDate: fd?.departureDate || booking.travel.checkIn,
    cabinClass: fd?.cabinClass || "",
    maxBudget: fd?.maxBudget || booking.preferences.maxBudgetPerNight,
    passengers: fd?.passengers || booking.travel.guestCount || 1,
  };

  let flights: FlightRecord[];
  if (cachedFlights && cachedFlights.length > 0) {
    flights = cachedFlights;
  } else {
    const fetchParams: Parameters<typeof fetchFlights>[0] = {};
    if (criteria.origin) fetchParams.origin = criteria.origin;
    if (criteria.destination) fetchParams.destination = criteria.destination;
    if (criteria.departureDate) fetchParams.startDate = criteria.departureDate;
    if (criteria.maxBudget > 0) fetchParams.maxPrice = Math.round(criteria.maxBudget * 1.5);
    if (criteria.cabinClass) fetchParams.cabinClass = criteria.cabinClass;
    flights = await fetchFlights(fetchParams);
  }

  // Build flight lookup map
  const flightMap = new Map<string, FlightRecord>();
  for (const flight of flights) {
    flightMap.set(flight.id, flight);
    flightMap.set(flight.airline, flight);
  }

  const options: FlightBookingOption[] = [];

  for (const flight of flights) {
    const { score, explanation } = scoreFlightOption(flight, criteria);

    if (score >= 30) {
      options.push({
        id: uuid(),
        bookingId: booking.id,
        category: "flight",
        flightId: flight.id,
        airline: flight.airline,
        flightNumber: flight.flightNumber,
        origin: flight.origin,
        destination: flight.destination,
        departureDate: flight.departureDate,
        returnDate: flight.returnDate,
        cabinClass: flight.cabinClass,
        totalPrice: flight.price * (criteria.passengers || 1),
        score,
        explanation,
      });
    }
  }

  // Sort by score descending
  options.sort((a, b) => b.score - a.score);

  return { options, flightMap };
}
