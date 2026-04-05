/**
 * Restaurant matching and ranking engine.
 * Fetches restaurants from MongoDB via the restaurant API, then scores and ranks options.
 */
import { BookingRequest, RestaurantRecord, RestaurantBookingOption } from "../types";
import { fetchRestaurants } from "./restaurant-api";
import { v4 as uuid } from "uuid";

interface RestaurantMatchCriteria {
  location: string;
  cuisine: string;
  priceRange: string;
  partySize: number;
}

/**
 * Convert price range string to a midpoint number for comparison.
 */
function priceRangeMidpoint(range: string): number {
  if (range === "100+") return 125;
  const parts = range.split("-").map(Number);
  return parts.length === 2 ? (parts[0] + parts[1]) / 2 : 0;
}

function scoreRestaurantOption(
  restaurant: RestaurantRecord,
  criteria: RestaurantMatchCriteria
): { score: number; explanation: string } {
  let score = 50; // base score
  const reasons: string[] = [];

  // Rating bonus (like hotel stars)
  score += Math.round(restaurant.rating * 3);
  reasons.push(`${restaurant.rating}-star rating`);

  // Cuisine match
  if (criteria.cuisine) {
    const normalizedCuisine = criteria.cuisine.toLowerCase();
    const normalizedRestaurant = restaurant.cuisine.toLowerCase();
    if (normalizedRestaurant.includes(normalizedCuisine) || normalizedCuisine.includes(normalizedRestaurant)) {
      score += 20;
      reasons.push("Matches preferred cuisine");
    } else {
      // Partial match — related cuisine types
      const related: Record<string, string[]> = {
        japanese: ["sushi", "ramen", "teppanyaki"],
        asian: ["chinese", "thai", "japanese", "korean", "sushi", "ramen", "hawker", "peranakan"],
        european: ["french", "italian", "steakhouse", "mediterranean"],
      };
      const isRelated = Object.values(related).some(
        (group) => group.some((c) => normalizedCuisine.includes(c)) && group.some((c) => normalizedRestaurant.includes(c))
      );
      if (isRelated) {
        score += 10;
        reasons.push("Related cuisine type");
      }
    }
  }

  // Price range fit
  if (criteria.priceRange) {
    const preferred = priceRangeMidpoint(criteria.priceRange);
    const actual = priceRangeMidpoint(restaurant.priceRange);
    if (actual <= preferred * 1.2) {
      score += 15;
      reasons.push(`${restaurant.priceRange} per person fits budget`);
    } else {
      score -= 10;
      reasons.push(`${restaurant.priceRange} per person may exceed budget`);
    }
  } else {
    reasons.push(`$${restaurant.priceRange} per person`);
  }

  // Amenity count bonus
  if (restaurant.amenities.length > 0) {
    score += Math.min(restaurant.amenities.length * 2, 10);
  }

  // Cap score
  score = Math.max(0, Math.min(100, score));

  return { score, explanation: reasons.join(". ") + "." };
}

export interface RestaurantMatchResult {
  options: RestaurantBookingOption[];
  restaurantMap: Map<string, RestaurantRecord>;
}

/**
 * Find and rank restaurant options for a booking.
 */
export async function findRestaurantOptions(
  booking: BookingRequest,
  cachedRestaurants?: RestaurantRecord[],
): Promise<RestaurantMatchResult> {
  const rd = booking.restaurantDetails;

  const criteria: RestaurantMatchCriteria = {
    location: rd?.location || booking.travel.destination,
    cuisine: rd?.cuisine || "",
    priceRange: rd?.priceRange || "",
    partySize: rd?.partySize || booking.travel.guestCount || 2,
  };

  let restaurants: RestaurantRecord[];
  if (cachedRestaurants && cachedRestaurants.length > 0) {
    restaurants = cachedRestaurants;
  } else {
    const fetchParams: Parameters<typeof fetchRestaurants>[0] = {};
    if (criteria.location) fetchParams.location = criteria.location;
    if (criteria.cuisine) fetchParams.cuisine = criteria.cuisine;
    if (criteria.priceRange) fetchParams.priceRange = criteria.priceRange;
    restaurants = await fetchRestaurants(fetchParams);
  }

  // Build restaurant lookup map
  const restaurantMap = new Map<string, RestaurantRecord>();
  for (const r of restaurants) {
    restaurantMap.set(r.id, r);
    restaurantMap.set(r.name, r);
  }

  const options: RestaurantBookingOption[] = [];

  for (const restaurant of restaurants) {
    const { score, explanation } = scoreRestaurantOption(restaurant, criteria);

    if (score >= 30) {
      options.push({
        id: uuid(),
        bookingId: booking.id,
        category: "restaurant",
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        cuisine: restaurant.cuisine,
        location: restaurant.location,
        priceRange: restaurant.priceRange,
        rating: restaurant.rating,
        amenities: restaurant.amenities,
        totalPrice: priceRangeMidpoint(restaurant.priceRange) * (criteria.partySize || 2),
        score,
        explanation,
      });
    }
  }

  // Sort by score descending
  options.sort((a, b) => b.score - a.score);

  return { options, restaurantMap };
}
