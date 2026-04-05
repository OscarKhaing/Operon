/**
 * Booking workflow state machine — drives the conversation through
 * well-defined stages, using LLM for understanding and generation,
 * and rule-based logic for hotel matching and dispatch.
 *
 * States:
 *   collecting_preferences ��� matching → options_presented →
 *   collecting_info → sent_to_hotel → confirmed
 */
import { store } from "../store";
import {
  BookingRequest, BookingCategory, ChatMessage, BookingOption, ConfirmedBookingSummary,
  MessageMetadata, HotelOptionCard, FlightOptionCard, RestaurantOptionCard,
  HotelBookingOption, FlightBookingOption, RestaurantBookingOption,
} from "../types";
import { findOptions } from "./matching";
import { findFlightOptions } from "./flight-matching";
import { findRestaurantOptions } from "./restaurant-matching";
import {
  extractPreferences,
  generatePreferenceReply,
  presentOptions,
  parseSelection,
  extractPersonalInfo,
  generateChecklistReply,
  detectCancelIntent,
  detectCategory,
  extractFlightPreferences,
  generateFlightPreferenceReply,
  presentFlightOptions,
  extractRestaurantPreferences,
  generateRestaurantPreferenceReply,
  presentRestaurantOptions,
} from "./llm";
import { generateDummyPdf } from "./pdf-dummy";
import {
  sendReservationEmail, sendCancellationEmail,
  sendFlightReservationEmail, sendRestaurantReservationEmail,
} from "./email";
import { simulateHotelResponse, simulateFlightResponse, simulateRestaurantResponse } from "./hotel-response";
import { fetchHotelById, fetchHotels, fetchAvailableLocations } from "./hotel-api";
import { createCheckoutSession } from "./stripe";
import { fetchFlights, fetchAvailableRoutes } from "./flight-api";
import { fetchRestaurants, fetchAvailableRestaurantLocations } from "./restaurant-api";

import { v4 as uuid } from "uuid";

/**
 * Result from the workflow — includes both plain text (for WhatsApp)
 * and optional structured metadata (for web UI rich rendering).
 */
export interface WorkflowResult {
  content: string;
  metadata?: MessageMetadata;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function addMsg(
  bookingId: string,
  role: ChatMessage["role"],
  content: string,
  metadata?: MessageMetadata,
): ChatMessage {
  const msg: ChatMessage = {
    id: uuid(),
    bookingId,
    role,
    content,
    timestamp: new Date().toISOString(),
    metadata: metadata ?? undefined,
  };
  store.addMessage(msg);
  return msg;
}

function recentConversation(bookingId: string, limit = 10): string {
  const msgs = store.getMessages(bookingId);
  return msgs
    .slice(-limit)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
}

function text(content: string): WorkflowResult {
  return { content };
}

function getOptionsForCategory(bookingId: string, category: BookingCategory): BookingOption[] {
  return store.getOptions(bookingId).filter((o) => o.category === category);
}

// ─── Multi-category helpers ────────────────────────────────────────────────

/** Get the effective active category for branching. */
function getActiveCategory(booking: BookingRequest): BookingCategory {
  return booking.activeCategory || booking.category || "hotel";
}

/** Get remaining categories that haven't been completed yet. */
function getRemainingCategories(booking: BookingRequest): BookingCategory[] {
  const all = booking.categories || (booking.category ? [booking.category] : []);
  const done = booking.completedCategories || [];
  return all.filter((c) => !done.includes(c));
}

/** Format a category name nicely for display. */
function categoryLabel(c: BookingCategory): string {
  return c === "hotel" ? "hotel" : c === "flight" ? "flight" : "restaurant";
}

/**
 * Cross-populate data from completed bookings into the next category,
 * then return a smart intro message listing assumptions and missing fields.
 */
function crossPopulateNextCategory(booking: BookingRequest, nextCategory: BookingCategory): string {
  const completed = booking.completedCategories || [];
  const assumptions: string[] = [];
  const stillNeed: string[] = [];

  // ── Gather available data from all completed categories ──
  const hotelDone = completed.includes("hotel");
  const flightDone = completed.includes("flight");

  const destination = booking.travel.destination || booking.flightDetails?.destination || booking.restaurantDetails?.location || "";
  const checkIn = booking.travel.checkIn || "";
  const checkOut = booking.travel.checkOut || "";
  const guestCount = booking.travel.guestCount || 0;
  const flightDest = booking.flightDetails?.destination || "";
  const flightDepart = booking.flightDetails?.departureDate || "";
  const flightReturn = booking.flightDetails?.returnDate || "";
  const passengers = booking.flightDetails?.passengers || 0;
  const restLocation = booking.restaurantDetails?.location || "";
  const partySize = booking.restaurantDetails?.partySize || 0;

  // ── Pre-populate and build message based on target category ──

  if (nextCategory === "flight") {
    const fd = booking.flightDetails || { origin: "", destination: "", departureDate: "", returnDate: "", passengers: 0, cabinClass: "", maxBudget: 0 };
    const updates: Partial<typeof fd> = {};

    // Destination from hotel or restaurant
    const inferredDest = destination;
    if (inferredDest && !fd.destination) {
      updates.destination = inferredDest;
      assumptions.push(`**Destination**: ${inferredDest} (from your ${hotelDone ? "hotel" : "restaurant"} booking)`);
    }

    // Departure date from hotel check-in
    if (hotelDone && checkIn && !fd.departureDate) {
      updates.departureDate = checkIn;
      assumptions.push(`**Departure date**: ${checkIn} (your hotel check-in date)`);
    }

    // Return date from hotel check-out
    if (hotelDone && checkOut && !fd.returnDate) {
      updates.returnDate = checkOut;
      assumptions.push(`**Return date**: ${checkOut} (your hotel checkout date)`);
    }

    // Passengers from hotel guests
    if (guestCount > 0 && !fd.passengers) {
      updates.passengers = guestCount;
      assumptions.push(`**Passengers**: ${guestCount} (same as your hotel guests)`);
    } else if (partySize > 0 && !fd.passengers) {
      updates.passengers = partySize;
      assumptions.push(`**Passengers**: ${partySize} (same as your restaurant party)`);
    }

    // What's still missing
    if (!updates.origin && !fd.origin) stillNeed.push("departure city");
    if (!updates.destination && !fd.destination) stillNeed.push("destination");
    if (!updates.departureDate && !fd.departureDate) stillNeed.push("departure date");
    if (!fd.cabinClass) stillNeed.push("cabin class preference (Economy, Business, etc.)");
    if (!fd.maxBudget) stillNeed.push("budget (optional)");

    store.updateBooking(booking.id, { flightDetails: { ...fd, ...updates } as BookingRequest["flightDetails"] });

  } else if (nextCategory === "restaurant") {
    const rd = booking.restaurantDetails || { location: "", date: "", time: "", partySize: 0, cuisine: "", priceRange: "" };
    const updates: Partial<typeof rd> = {};

    // Location from hotel destination or flight destination
    const inferredLoc = destination || flightDest;
    if (inferredLoc && !rd.location) {
      updates.location = inferredLoc;
      assumptions.push(`**Location**: ${inferredLoc} (from your ${hotelDone ? "hotel" : "flight"} booking)`);
    }

    // Party size from guests or passengers
    if (guestCount > 0 && !rd.partySize) {
      updates.partySize = guestCount;
      assumptions.push(`**Party size**: ${guestCount} (same as your hotel guests)`);
    } else if (passengers > 0 && !rd.partySize) {
      updates.partySize = passengers;
      assumptions.push(`**Party size**: ${passengers} (same as your flight passengers)`);
    }

    // Date: first night of hotel stay or flight arrival
    if (hotelDone && checkIn && !rd.date) {
      updates.date = checkIn;
      assumptions.push(`**Date**: ${checkIn} (first night of your hotel stay)`);
    } else if (flightDone && flightDepart && !rd.date) {
      updates.date = flightDepart;
      assumptions.push(`**Date**: ${flightDepart} (your arrival date)`);
    }

    // What's still missing
    if (!updates.location && !rd.location) stillNeed.push("location/city");
    if (!updates.date && !rd.date) stillNeed.push("date");
    if (!rd.time) stillNeed.push("preferred time");
    if (!rd.cuisine) stillNeed.push("cuisine preference (optional)");
    if (!rd.priceRange) stillNeed.push("price range (optional)");

    store.updateBooking(booking.id, { restaurantDetails: { ...rd, ...updates } as BookingRequest["restaurantDetails"] });

  } else if (nextCategory === "hotel") {
    const travelUpdates: Record<string, unknown> = {};
    const prefUpdates: Record<string, unknown> = {};

    // Destination from flight or restaurant
    const inferredDest = flightDest || restLocation;
    if (inferredDest && !booking.travel.destination) {
      travelUpdates.destination = inferredDest;
      assumptions.push(`**Destination**: ${inferredDest} (from your ${flightDone ? "flight" : "restaurant"} booking)`);
    }

    // Dates from flight
    if (flightDone && flightDepart && !booking.travel.checkIn) {
      travelUpdates.checkIn = flightDepart;
      assumptions.push(`**Check-in**: ${flightDepart} (your flight arrival date)`);
    }
    if (flightDone && flightReturn && !booking.travel.checkOut) {
      travelUpdates.checkOut = flightReturn;
      assumptions.push(`**Check-out**: ${flightReturn} (your return flight date)`);
    }

    // Guests from passengers or party
    if (passengers > 0 && guestCount <= 0) {
      travelUpdates.guestCount = passengers;
      assumptions.push(`**Guests**: ${passengers} (same as your flight passengers)`);
    } else if (partySize > 0 && guestCount <= 0) {
      travelUpdates.guestCount = partySize;
      assumptions.push(`**Guests**: ${partySize} (same as your restaurant party)`);
    }

    // What's still missing
    if (!travelUpdates.destination && !booking.travel.destination) stillNeed.push("destination");
    if (!travelUpdates.checkIn && !booking.travel.checkIn) stillNeed.push("check-in date");
    if (!travelUpdates.checkOut && !booking.travel.checkOut) stillNeed.push("check-out date");
    if (!booking.preferences.roomType) stillNeed.push("room type preference (optional)");
    if (!booking.preferences.maxBudgetPerNight) stillNeed.push("budget per night (optional)");

    if (Object.keys(travelUpdates).length > 0) {
      store.updateBooking(booking.id, { travel: { ...booking.travel, ...travelUpdates } as BookingRequest["travel"] });
    }
    if (Object.keys(prefUpdates).length > 0) {
      store.updateBooking(booking.id, { preferences: { ...booking.preferences, ...prefUpdates } as BookingRequest["preferences"] });
    }
  }

  // Update category and status
  store.updateBooking(booking.id, {
    category: nextCategory,
    activeCategory: nextCategory,
    status: "extracting",
  });
  addMsg(booking.id, "system", `Transitioning to ${nextCategory} booking with cross-populated data`);

  // Build the intro message
  let intro = `Now for your **${categoryLabel(nextCategory)}** booking!`;

  if (assumptions.length > 0) {
    intro += `\n\nBased on your previous booking, I've pre-filled:\n${assumptions.map((a) => `- ${a}`).join("\n")}`;
    intro += `\n\nFeel free to change any of these — just let me know.`;
  }

  if (stillNeed.length > 0) {
    intro += `\n\nI still need: **${stillNeed.join("**, **")}**.`;
    if (stillNeed.length === 1) {
      intro += ` What's your ${stillNeed[0]}?`;
    }
  } else {
    intro += `\n\nI have everything I need — let me search for options!`;
  }

  return intro;
}

/**
 * Transition to the next category after one is confirmed.
 * Uses cross-population to pre-fill data and generate a smart intro.
 */
function transitionToNextCategory(booking: BookingRequest): WorkflowResult | null {
  const remaining = getRemainingCategories(booking);
  if (remaining.length === 0) return null;

  const intro = crossPopulateNextCategory(booking, remaining[0]);
  return text(intro);
}

// ─── Phase: Collect booking preferences (category-aware) ───────────────────

async function handleCollectingPreferences(
  booking: BookingRequest,
  _customerMessage: string
): Promise<WorkflowResult> {
  const category = getActiveCategory(booking);
  switch (category) {
    case "flight": return handleFlightPreferences(booking);
    case "restaurant": return handleRestaurantPreferences(booking);
    default: return handleHotelPreferences(booking);
  }
}

// ── Hotel preferences ──

const HOTEL_REQUIRED = ["destination", "checkIn", "checkOut"] as const;
const HOTEL_ALL = ["destination", "checkIn", "checkOut", "guestCount", "roomType", "maxBudget"] as const;

async function handleHotelPreferences(booking: BookingRequest): Promise<WorkflowResult> {
  const convo = recentConversation(booking.id);
  const availableLocations = await fetchAvailableLocations();
  const prefs = await extractPreferences(convo, availableLocations);

  const travelUpdates: Record<string, unknown> = {};
  if (prefs.checkIn) travelUpdates.checkIn = prefs.checkIn;
  if (prefs.checkOut) travelUpdates.checkOut = prefs.checkOut;
  if (prefs.guestCount) travelUpdates.guestCount = prefs.guestCount;

  const previousDestination = booking.travel.destination;
  if (prefs.destination) {
    travelUpdates.destination = prefs.destination;
    if (previousDestination && previousDestination !== prefs.destination) {
      store.clearHotelCache(booking.id);
      store.clearOptions(booking.id);
      addMsg(booking.id, "system", `Destination changed: ${previousDestination} → ${prefs.destination}`);
    }
  }

  const prefUpdates: Record<string, unknown> = {};
  if (prefs.roomType) prefUpdates.roomType = prefs.roomType;
  if (prefs.maxBudget) prefUpdates.maxBudgetPerNight = prefs.maxBudget;

  if (Object.keys(travelUpdates).length > 0) {
    store.updateBooking(booking.id, {
      travel: { ...booking.travel, ...travelUpdates } as BookingRequest["travel"],
    });
  }
  if (Object.keys(prefUpdates).length > 0) {
    store.updateBooking(booking.id, {
      preferences: { ...booking.preferences, ...prefUpdates } as BookingRequest["preferences"],
    });
  }

  const resolvedDestination = prefs.destination || booking.travel.destination;
  if (resolvedDestination && !store.getHotelCache(booking.id)) {
    const hotels = await fetchHotels({ location: resolvedDestination });
    if (hotels.length > 0) {
      store.setHotelCache(booking.id, hotels);
      addMsg(booking.id, "system", `Loaded ${hotels.length} hotels for ${resolvedDestination}`);
    } else if (prefs.destination && !availableLocations.some(
      (loc) => loc.toLowerCase().includes(prefs.destination!.toLowerCase()) ||
               prefs.destination!.toLowerCase().includes(loc.toLowerCase())
    )) {
      addMsg(booking.id, "system", `No hotels in pool for: ${resolvedDestination}`);
      store.updateBooking(booking.id, {
        travel: { ...store.getBooking(booking.id)!.travel, destination: "" },
      });
      return text(
        `Unfortunately, we don't have contracted hotels in ${resolvedDestination} at the moment. ` +
        `Our current destinations include: ${availableLocations.join(", ")}.\n\n` +
        `Would you like to choose one of these?`
      );
    }
  }

  const extracted = Object.entries(prefs).filter(([, v]) => v !== null).map(([k, v]) => `${k}=${v}`).join(", ");
  if (extracted) addMsg(booking.id, "system", `Extracted preferences: ${extracted}`);

  const updated = store.getBooking(booking.id)!;
  const knownFields: Record<string, string | number | null> = {
    destination: updated.travel.destination || null,
    checkIn: updated.travel.checkIn || null,
    checkOut: updated.travel.checkOut || null,
    guestCount: updated.travel.guestCount > 0 ? updated.travel.guestCount : null,
    roomType: updated.preferences.roomType || null,
    maxBudget: updated.preferences.maxBudgetPerNight > 0 ? updated.preferences.maxBudgetPerNight : null,
  };
  const requiredMissing = HOTEL_REQUIRED.filter((f) => knownFields[f] === null || knownFields[f] === undefined);
  const optionalMissing = HOTEL_ALL.filter(
    (f) => !HOTEL_REQUIRED.includes(f as typeof HOTEL_REQUIRED[number]) && (knownFields[f] === null || knownFields[f] === undefined)
  );

  if (requiredMissing.length === 0) {
    store.updateBooking(booking.id, { status: "matching" });
    return handleMatching(booking.id);
  }

  store.updateBooking(booking.id, { status: "extracting" });
  const allMissing = [...requiredMissing, ...optionalMissing];
  const reply = await generatePreferenceReply(convo, knownFields, allMissing, booking.conciseMode);
  return text(reply);
}

// ── Flight preferences ──

const FLIGHT_REQUIRED = ["origin", "destination", "departureDate"] as const;
const FLIGHT_ALL = ["origin", "destination", "departureDate", "returnDate", "passengers", "cabinClass", "maxBudget"] as const;

async function handleFlightPreferences(booking: BookingRequest): Promise<WorkflowResult> {
  const convo = recentConversation(booking.id);
  const availableRoutes = await fetchAvailableRoutes();

  // Build known fields from pre-populated/existing flightDetails to give LLM context
  const fd = booking.flightDetails || { origin: "", destination: "", departureDate: "", returnDate: "", passengers: 0, cabinClass: "", maxBudget: 0 };
  const currentKnown: Record<string, string | number | null> = {
    origin: fd.origin || null,
    destination: fd.destination || null,
    departureDate: fd.departureDate || null,
    returnDate: fd.returnDate || null,
    passengers: fd.passengers > 0 ? fd.passengers : null,
    cabinClass: fd.cabinClass || null,
    maxBudget: fd.maxBudget > 0 ? fd.maxBudget : null,
  };
  const prefs = await extractFlightPreferences(convo, availableRoutes, currentKnown);
  const updates: Record<string, unknown> = {};
  if (prefs.origin) updates.origin = prefs.origin;
  if (prefs.destination) updates.destination = prefs.destination;
  if (prefs.departureDate) updates.departureDate = prefs.departureDate;
  if (prefs.returnDate) updates.returnDate = prefs.returnDate;
  if (prefs.passengers) updates.passengers = prefs.passengers;
  if (prefs.cabinClass) updates.cabinClass = prefs.cabinClass;
  if (prefs.maxBudget) updates.maxBudget = prefs.maxBudget;

  if (Object.keys(updates).length > 0) {
    const newFd = { ...fd, ...updates };
    store.updateBooking(booking.id, { flightDetails: newFd as BookingRequest["flightDetails"] });

    // If destination changed, clear flight cache
    if (updates.destination && fd.destination && fd.destination !== updates.destination) {
      store.clearFlightCache(booking.id);
      store.clearOptions(booking.id);
    }
  }

  // Pre-load flights
  const resolvedDest = prefs.destination || fd.destination;
  const resolvedOrigin = prefs.origin || fd.origin;
  if (resolvedDest && resolvedOrigin && !store.getFlightCache(booking.id)) {
    const flights = await fetchFlights({ origin: resolvedOrigin, destination: resolvedDest });
    if (flights.length > 0) {
      store.setFlightCache(booking.id, flights);
      addMsg(booking.id, "system", `Loaded ${flights.length} flights for ${resolvedOrigin} → ${resolvedDest}`);
    }
  }

  const extracted = Object.entries(prefs).filter(([, v]) => v !== null).map(([k, v]) => `${k}=${v}`).join(", ");
  if (extracted) addMsg(booking.id, "system", `Extracted flight preferences: ${extracted}`);

  const updatedBooking = store.getBooking(booking.id)!;
  const ufd = updatedBooking.flightDetails || fd;
  const knownFields: Record<string, string | number | null> = {
    origin: ufd.origin || null,
    destination: ufd.destination || null,
    departureDate: ufd.departureDate || null,
    returnDate: ufd.returnDate || null,
    passengers: ufd.passengers > 0 ? ufd.passengers : null,
    cabinClass: ufd.cabinClass || null,
    maxBudget: ufd.maxBudget > 0 ? ufd.maxBudget : null,
  };
  const requiredMissing = FLIGHT_REQUIRED.filter((f) => !knownFields[f]);
  const optionalMissing = FLIGHT_ALL.filter(
    (f) => !FLIGHT_REQUIRED.includes(f as typeof FLIGHT_REQUIRED[number]) && !knownFields[f]
  );

  if (requiredMissing.length === 0) {
    store.updateBooking(booking.id, { status: "matching" });
    return handleMatching(booking.id);
  }

  store.updateBooking(booking.id, { status: "extracting" });
  const allMissing = [...requiredMissing, ...optionalMissing];
  const reply = await generateFlightPreferenceReply(convo, knownFields, allMissing, booking.conciseMode);
  return text(reply);
}

// ── Restaurant preferences ──

const RESTAURANT_REQUIRED = ["location", "date", "time"] as const;
const RESTAURANT_ALL = ["location", "date", "time", "partySize", "cuisine", "priceRange"] as const;

async function handleRestaurantPreferences(booking: BookingRequest): Promise<WorkflowResult> {
  const convo = recentConversation(booking.id);
  const availableLocations = await fetchAvailableRestaurantLocations();

  // Build known fields from pre-populated/existing restaurantDetails to give LLM context
  const rd = booking.restaurantDetails || { location: "", date: "", time: "", partySize: 0, cuisine: "", priceRange: "" };
  const currentKnown: Record<string, string | number | null> = {
    location: rd.location || null,
    date: rd.date || null,
    time: rd.time || null,
    partySize: rd.partySize > 0 ? rd.partySize : null,
    cuisine: rd.cuisine || null,
    priceRange: rd.priceRange || null,
  };
  const prefs = await extractRestaurantPreferences(convo, availableLocations, currentKnown);
  const updates: Record<string, unknown> = {};
  if (prefs.location) updates.location = prefs.location;
  if (prefs.date) updates.date = prefs.date;
  if (prefs.time) updates.time = prefs.time;
  if (prefs.partySize) updates.partySize = prefs.partySize;
  if (prefs.cuisine) updates.cuisine = prefs.cuisine;
  if (prefs.priceRange) updates.priceRange = prefs.priceRange;

  if (Object.keys(updates).length > 0) {
    const newRd = { ...rd, ...updates };
    store.updateBooking(booking.id, { restaurantDetails: newRd as BookingRequest["restaurantDetails"] });

    if (updates.location && rd.location && rd.location !== updates.location) {
      store.clearRestaurantCache(booking.id);
      store.clearOptions(booking.id);
    }
  }

  // Pre-load restaurants
  const resolvedLocation = prefs.location || rd.location;
  if (resolvedLocation && !store.getRestaurantCache(booking.id)) {
    const restaurants = await fetchRestaurants({ location: resolvedLocation });
    if (restaurants.length > 0) {
      store.setRestaurantCache(booking.id, restaurants);
      addMsg(booking.id, "system", `Loaded ${restaurants.length} restaurants for ${resolvedLocation}`);
    }
  }

  const extracted = Object.entries(prefs).filter(([, v]) => v !== null).map(([k, v]) => `${k}=${v}`).join(", ");
  if (extracted) addMsg(booking.id, "system", `Extracted restaurant preferences: ${extracted}`);

  const updatedBooking = store.getBooking(booking.id)!;
  const urd = updatedBooking.restaurantDetails || rd;
  const knownFields: Record<string, string | number | null> = {
    location: urd.location || null,
    date: urd.date || null,
    time: urd.time || null,
    partySize: urd.partySize > 0 ? urd.partySize : null,
    cuisine: urd.cuisine || null,
    priceRange: urd.priceRange || null,
  };
  const requiredMissing = RESTAURANT_REQUIRED.filter((f) => !knownFields[f]);
  const optionalMissing = RESTAURANT_ALL.filter(
    (f) => !RESTAURANT_REQUIRED.includes(f as typeof RESTAURANT_REQUIRED[number]) && !knownFields[f]
  );

  if (requiredMissing.length === 0) {
    store.updateBooking(booking.id, { status: "matching" });
    return handleMatching(booking.id);
  }

  store.updateBooking(booking.id, { status: "extracting" });
  const allMissing = [...requiredMissing, ...optionalMissing];
  const reply = await generateRestaurantPreferenceReply(convo, knownFields, allMissing, booking.conciseMode);
  return text(reply);
}

// ─── Phase: Matching (rule-based) + LLM presentation — category-aware ─────

async function handleMatching(bookingId: string): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId)!;
  const category = getActiveCategory(booking);

  switch (category) {
    case "flight": return handleFlightMatching(booking);
    case "restaurant": return handleRestaurantMatching(booking);
    default: return handleHotelMatching(booking);
  }
}

async function handleHotelMatching(booking: BookingRequest): Promise<WorkflowResult> {
  const cachedHotels = store.getHotelCache(booking.id);
  const { options, hotelMap } = await findOptions(booking, cachedHotels);
  store.clearOptions(booking.id);
  store.addOptions(options);

  if (options.length === 0) {
    store.updateBooking(booking.id, { status: "extracting" });
    return text("I couldn't find any hotels matching your criteria in our contracted pool. Could you consider a different destination, adjust your dates, or increase your budget?");
  }

  store.updateBooking(booking.id, { status: "options_presented" });
  addMsg(booking.id, "system", `Found ${options.length} hotel options. Top score: ${options[0].score}`);

  const top = options.slice(0, 5) as HotelBookingOption[];
  const optionCards: HotelOptionCard[] = top.map((o) => ({
    optionId: o.id,
    hotelName: o.hotelName,
    roomType: o.roomType.name,
    pricePerNight: o.roomType.basePrice,
    totalPrice: o.totalPrice,
    nights: o.nightCount,
    stars: hotelMap.get(o.hotelId)?.stars || hotelMap.get(o.hotelName)?.stars || 4,
    amenities: o.roomType.amenities,
    score: o.score,
    explanation: o.explanation,
  }));

  const customerName = booking.customer.name || "there";
  const plainText = await presentOptions(
    customerName,
    booking.travel.destination,
    optionCards.map((o, i) => ({ number: i + 1, ...o }))
  );

  return { content: plainText, metadata: { type: "hotel_options", options: optionCards } };
}

async function handleFlightMatching(booking: BookingRequest): Promise<WorkflowResult> {
  const cachedFlights = store.getFlightCache(booking.id);
  const { options } = await findFlightOptions(booking, cachedFlights);
  store.clearOptions(booking.id);
  store.addOptions(options);

  if (options.length === 0) {
    store.updateBooking(booking.id, { status: "extracting" });

    // Diagnostic: check if flights exist on this route but outside requested dates
    const fd = booking.flightDetails;
    if (fd?.origin && fd?.destination) {
      const allOnRoute = await fetchFlights({ origin: fd.origin, destination: fd.destination });
      if (allOnRoute.length > 0) {
        const earliest = allOnRoute.reduce((a, b) => a.departureDate < b.departureDate ? a : b);
        const latest = allOnRoute.reduce((a, b) => a.returnDate > b.returnDate ? a : b);
        const rangeStart = new Date(earliest.departureDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const rangeEnd = new Date(latest.returnDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

        return text(
          `I found flights on the **${fd.origin} → ${fd.destination}** route, but they're only available between **${rangeStart}** and **${rangeEnd}**. ` +
          `Your requested dates (${fd.departureDate} to ${fd.returnDate || "one-way"}) fall outside that window.\n\n` +
          `Would you like to adjust your travel dates, or try a different route?`
        );
      }

      // No flights on this route at all
      return text(
        `Unfortunately, we don't have any flights on the **${fd.origin} → ${fd.destination}** route in our system. ` +
        `Would you like to try a different departure city or destination?`
      );
    }

    return text("I couldn't find any flights matching your criteria. Could you consider different dates, a different route, or adjust your budget?");
  }

  store.updateBooking(booking.id, { status: "options_presented" });
  addMsg(booking.id, "system", `Found ${options.length} flight options. Top score: ${options[0].score}`);

  const top = options.slice(0, 5) as FlightBookingOption[];
  const optionCards: FlightOptionCard[] = top.map((o) => ({
    optionId: o.id,
    airline: o.airline,
    flightNumber: o.flightNumber,
    origin: o.origin,
    destination: o.destination,
    departureDate: o.departureDate,
    returnDate: o.returnDate,
    cabinClass: o.cabinClass,
    price: o.totalPrice,
    score: o.score,
    explanation: o.explanation,
  }));

  const customerName = booking.customer.name || "there";
  const fd = booking.flightDetails;
  const route = fd ? `${fd.origin} → ${fd.destination}` : "your route";
  const plainText = await presentFlightOptions(
    customerName,
    route,
    optionCards.map((o, i) => ({ number: i + 1, ...o }))
  );

  return { content: plainText, metadata: { type: "flight_options", options: optionCards } };
}

async function handleRestaurantMatching(booking: BookingRequest): Promise<WorkflowResult> {
  const cachedRestaurants = store.getRestaurantCache(booking.id);
  const { options } = await findRestaurantOptions(booking, cachedRestaurants);
  store.clearOptions(booking.id);
  store.addOptions(options);

  if (options.length === 0) {
    store.updateBooking(booking.id, { status: "extracting" });
    return text("I couldn't find any restaurants matching your criteria. Could you consider a different location, cuisine, or price range?");
  }

  store.updateBooking(booking.id, { status: "options_presented" });
  addMsg(booking.id, "system", `Found ${options.length} restaurant options. Top score: ${options[0].score}`);

  const top = options.slice(0, 5) as RestaurantBookingOption[];
  const optionCards: RestaurantOptionCard[] = top.map((o) => ({
    optionId: o.id,
    restaurantName: o.restaurantName,
    cuisine: o.cuisine,
    location: o.location,
    priceRange: o.priceRange,
    rating: o.rating,
    amenities: o.amenities,
    score: o.score,
    explanation: o.explanation,
  }));

  const customerName = booking.customer.name || "there";
  const location = booking.restaurantDetails?.location || booking.travel.destination;
  const plainText = await presentRestaurantOptions(
    customerName,
    location,
    optionCards.map((o, i) => ({ number: i + 1, ...o }))
  );

  return { content: plainText, metadata: { type: "restaurant_options", options: optionCards } };
}

// ─── Phase: Awaiting customer selection ─────────────────────────────────────

/**
 * Deterministic selection — called when the web UI sends a direct option click.
 * Bypasses LLM parsing entirely. Also used by processMessage when metadata is present.
 */
export async function selectOption(
  bookingId: string,
  optionIndex: number,
): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId);
  if (!booking) return text("Booking not found.");

  const category = getActiveCategory(booking);
  const options = getOptionsForCategory(bookingId, category);
  const topOptions = options.slice(0, 5);

  if (optionIndex < 0 || optionIndex >= topOptions.length) {
    return text(`I only have options 1 through ${topOptions.length}. Which one would you like?`);
  }

  const chosen = topOptions[optionIndex];
  return confirmSelection(booking, chosen, optionIndex + 1);
}

/**
 * LLM-based selection — parses free-text input (for WhatsApp / typed responses).
 */
async function handleAwaitingSelectionText(
  booking: BookingRequest,
  customerMessage: string
): Promise<WorkflowResult> {
  const category = getActiveCategory(booking);
  const options = getOptionsForCategory(booking.id, category);
  const topOptions = options.slice(0, 5);

  const selection = await parseSelection(customerMessage, topOptions.length);

  if (selection.intent === "negotiate") {
    return text("I understand! Could you tell me what you'd like adjusted — lower price, different room type, or a different hotel style? I'll search again for you.");
  }

  if (selection.intent === "reject") {
    store.updateBooking(booking.id, { status: "extracting" });
    return text("No problem at all. Would you like to try a different destination or adjust your preferences? I'm happy to search again.");
  }

  if (selection.selectedOption === null || selection.intent === "unclear") {
    return text("I wasn't sure which option you'd like. Could you let me know the option number (e.g., \"option 1\") or describe what you prefer?");
  }

  // Valid selection
  const idx = selection.selectedOption - 1;
  if (idx < 0 || idx >= topOptions.length) {
    return text(`I only have options 1 through ${topOptions.length}. Which one would you like?`);
  }

  const chosen = topOptions[idx];
  return confirmSelection(booking, chosen, selection.selectedOption);
}

/**
 * Shared logic after a valid selection (from either click or LLM parse).
 * Category-aware: generates different confirmation messages and info requests.
 */
function confirmSelection(
  booking: BookingRequest,
  chosen: BookingOption,
  displayNumber: number,
): WorkflowResult {
  store.updateBooking(booking.id, {
    status: "selected",
    selectedOptionId: chosen.id,
  });

  let selectionSummary: string;
  let confirmMsg: string;

  if (chosen.category === "hotel") {
    const h = chosen as HotelBookingOption;
    selectionSummary = `${h.hotelName} - ${h.roomType.name} ($${h.totalPrice})`;
    confirmMsg = `Great choice! You've selected **${h.hotelName} - ${h.roomType.name}** at $${h.roomType.basePrice}/night ($${h.totalPrice} total).\n\nTo complete the reservation, I'll need a few personal details. Could you please provide:\n1. Your full name (as on passport)\n2. Passport number\n3. Nationality\n4. Email address\n5. Phone number`;
  } else if (chosen.category === "flight") {
    const f = chosen as FlightBookingOption;
    selectionSummary = `${f.airline} ${f.flightNumber} ${f.origin} → ${f.destination} ($${f.totalPrice})`;
    confirmMsg = `Great choice! You've selected **${f.airline} ${f.flightNumber}** (${f.origin} → ${f.destination}, ${f.cabinClass}) for $${f.totalPrice}.\n\nTo complete the booking, I'll need a few personal details. Could you please provide:\n1. Your full name (as on passport)\n2. Passport number\n3. Nationality\n4. Email address\n5. Phone number`;
  } else {
    const r = chosen as RestaurantBookingOption;
    selectionSummary = `${r.restaurantName} - ${r.cuisine} ($${r.priceRange}/person)`;
    confirmMsg = `Great choice! You've selected **${r.restaurantName}** (${r.cuisine} in ${r.location}).\n\nTo complete the reservation, I'll need a few details. Could you please provide:\n1. Your full name\n2. Email address\n3. Phone number`;
  }

  addMsg(booking.id, "system", `Customer selected option ${displayNumber}: ${selectionSummary}`);
  store.updateBooking(booking.id, { status: "collecting_info" });

  return text(confirmMsg);
}

// ─── Phase: Collect personal info via checklist ─────────────────────────────

const HOTEL_FLIGHT_FIELDS = ["name", "passport", "nationality", "email", "phone"] as const;
const RESTAURANT_FIELDS = ["name", "email", "phone"] as const;

function getPersonalFields(category: BookingCategory | undefined): readonly string[] {
  return category === "restaurant" ? RESTAURANT_FIELDS : HOTEL_FLIGHT_FIELDS;
}

async function handleCollectingInfo(
  booking: BookingRequest,
  customerMessage: string
): Promise<WorkflowResult> {
  const category = getActiveCategory(booking);
  const requiredFields = getPersonalFields(category);

  // LLM extraction of personal info from latest message
  const extracted = await extractPersonalInfo(customerMessage);

  // Merge into booking customer — only fill empty fields to prevent LLM overwrites
  const customerUpdates: Record<string, string> = {};
  if (extracted.name && !booking.customer.name) customerUpdates.name = extracted.name;
  if (extracted.email && !booking.customer.email) customerUpdates.email = extracted.email;
  if (extracted.phone && !booking.customer.phone) customerUpdates.phone = extracted.phone;
  // Passport and nationality only for hotel/flight
  if (category !== "restaurant") {
    if (extracted.passport && !booking.customer.passport) customerUpdates.passport = extracted.passport;
    if (extracted.nationality && !booking.customer.nationality) customerUpdates.nationality = extracted.nationality;
  }

  if (Object.keys(customerUpdates).length > 0) {
    store.updateBooking(booking.id, {
      customer: { ...booking.customer, ...customerUpdates },
    });
    addMsg(
      booking.id,
      "system",
      `Collected: ${Object.entries(customerUpdates).map(([k, v]) => `${k}=${v}`).join(", ")}`
    );
  }

  // Re-read updated booking
  const updated = store.getBooking(booking.id)!;

  // Check what's still missing
  const collected: Record<string, string | null> = {
    name: updated.customer.name || null,
    email: updated.customer.email || null,
    phone: updated.customer.phone || null,
  };
  if (category !== "restaurant") {
    collected.passport = updated.customer.passport || null;
    collected.nationality = updated.customer.nationality || null;
  }
  const missing = requiredFields.filter((f) => !collected[f]);

  if (missing.length === 0) {
    // All personal info collected!
    const options = getOptionsForCategory(booking.id, category);
    const selectedOption = booking.selectedOptionId
      ? options.find((option) => option.id === booking.selectedOptionId)
      : options[0];
    if (!selectedOption) {
      return text("I couldn't find your selected option. Please choose an option again.");
    }

    if (selectedOption.category === "restaurant") {
      addMsg(booking.id, "system", "All personal info collected. Sending reservation request...");
      return triggerDispatch(booking.id, selectedOption);
    }

    addMsg(booking.id, "system", "All personal info collected. Creating payment link...");

    // Build payment description based on category
    let itemName: string;
    let itemDescription: string;
    if (selectedOption.category === "hotel") {
      itemName = `${selectedOption.hotelName} — ${selectedOption.roomType.name}`;
      itemDescription = `Check-in: ${booking.travel.checkIn} → Check-out: ${booking.travel.checkOut}`;
    } else if (selectedOption.category === "flight") {
      itemName = `${selectedOption.airline} ${selectedOption.flightNumber}`;
      itemDescription = `${selectedOption.origin} → ${selectedOption.destination} (${selectedOption.cabinClass})`;
    } else{
      itemName = "NULL";
      itemDescription = "NULL2";
    }

    const { url, sessionId } = await createCheckoutSession({
      bookingId: booking.id,
      totalPrice: selectedOption.totalPrice,
      hotelName: itemName,
      roomType: itemDescription,
      checkIn: booking.travel.checkIn || booking.flightDetails?.departureDate || booking.restaurantDetails?.date || "",
      checkOut: booking.travel.checkOut || booking.flightDetails?.returnDate || "",
      guestEmail: booking.customer.email || undefined,
      currency: booking.preferences.currency || "USD",
    });

    store.updateBooking(booking.id, {
      status: "awaiting_payment",
      stripeSessionId: sessionId,
      paymentStatus: "unpaid",
    });
    addMsg(booking.id, "system", `Stripe session created: ${sessionId}`);

    return text(
      `Almost there! To confirm your reservation for **${itemName}**, please complete your payment of **$${selectedOption.totalPrice}** using this secure link:\n\n${url}\n\nOnce payment is complete, I'll send the reservation immediately.`
    );
  }

  // Still collecting — LLM generates natural follow-up
  const convoSnippet = recentConversation(booking.id, 4);
  const reply = await generateChecklistReply(convoSnippet, collected, missing as string[], category);
  return text(reply);
}

// ─── Dispatch: dummy PDF + real email via Resend ────────────────────────────

export async function triggerDispatch(bookingId: string, option: BookingOption): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId)!;
  const category = getActiveCategory(booking);

  switch (category) {
    case "flight": return triggerFlightDispatch(bookingId, option as FlightBookingOption);
    case "restaurant": return triggerRestaurantDispatch(bookingId, option as RestaurantBookingOption);
    default: return triggerHotelDispatch(bookingId, option as HotelBookingOption);
  }
}

async function triggerHotelDispatch(bookingId: string, option: HotelBookingOption): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId)!;
  const hotel = await fetchHotelById(option.hotelId);
  const hotelEmail = hotel?.contactEmail || "hotel@example.com";

  const pdfResult = generateDummyPdf({
    bookingId,
    guestName: booking.customer.name,
    passport: booking.customer.passport,
    nationality: booking.customer.nationality,
    email: booking.customer.email,
    phone: booking.customer.phone,
    hotelName: option.hotelName,
    roomType: option.roomType.name,
    checkIn: booking.travel.checkIn,
    checkOut: booking.travel.checkOut,
    guestCount: booking.travel.guestCount,
    totalPrice: option.totalPrice,
    hotelEmail,
    specialRequests: booking.preferences.specialRequests,
  });

  store.updateBooking(bookingId, { pdfUrl: pdfResult.pdfPath });
  addMsg(bookingId, "system", `PDF generated: ${pdfResult.pdfPath}`);

  const emailResult = await sendReservationEmail({
    hotelEmail,
    hotelName: option.hotelName,
    guestName: booking.customer.name,
    passport: booking.customer.passport,
    nationality: booking.customer.nationality,
    guestEmail: booking.customer.email,
    guestPhone: booking.customer.phone,
    roomType: option.roomType.name,
    checkIn: booking.travel.checkIn,
    checkOut: booking.travel.checkOut,
    guestCount: booking.travel.guestCount,
    totalPrice: option.totalPrice,
    currency: booking.preferences.currency || "USD",
    specialRequests: booking.preferences.specialRequests,
  });

  if (emailResult.success) {
    addMsg(bookingId, "system", `Email sent to ${emailResult.sentTo} via Resend (ID: ${emailResult.emailId})`);
  } else {
    addMsg(bookingId, "system", `Email to ${emailResult.sentTo} failed: ${emailResult.error}`);
  }

  store.createTransaction({
    id: uuid(), bookingId, selectedOptionId: option.id,
    documentUrl: pdfResult.pdfPath, sentAt: new Date().toISOString(),
    confirmedAt: null, confirmationCode: null, status: "sent",
  });
  store.updateBooking(bookingId, { status: "sent_to_hotel" });
  simulateHotelResponse(bookingId);

  // Track this category as completed + store summary
  const completed = [...(booking.completedCategories || []), "hotel" as BookingCategory];
  const updatedBooking = store.getBooking(bookingId)!;
  const tx = store.getLatestTransaction(bookingId);
  const code = tx?.confirmationCode ?? "";
  const confirmedSummary: ConfirmedBookingSummary = {
    category: "hotel",
    providerName: option.hotelName,
    details: `${updatedBooking.travel.checkIn} to ${updatedBooking.travel.checkOut}, ${updatedBooking.travel.destination}`,
    totalPrice: option.totalPrice,
    confirmationCode: code,
  };
  store.updateBooking(bookingId, {
    completedCategories: completed,
    confirmedBookings: [...(booking.confirmedBookings || []), confirmedSummary],
  });

  const emailNote = emailResult.success
    ? `The reservation details have been sent to **${option.hotelName}** (${hotelEmail}).`
    : `The reservation was prepared for **${option.hotelName}**, but the email couldn't be delivered right now. Our team will follow up manually.`;

  const summary = `${emailNote}\n\nHere's your summary:\n- Guest: ${updatedBooking.customer.name}\n- Hotel: ${option.hotelName} - ${option.roomType.name}\n- Dates: ${updatedBooking.travel.checkIn} to ${updatedBooking.travel.checkOut}\n- Total: $${option.totalPrice}` +
    (code ? `\n- Confirmation Code: **${code}**` : "");

  // Auto-transition to next category with smart intro
  const remaining = getRemainingCategories(store.getBooking(bookingId)!);
  if (remaining.length > 0) {
    const intro = crossPopulateNextCategory(store.getBooking(bookingId)!, remaining[0]);
    return text(`${summary}\n\n---\n\n${intro}`);
  }

  return text(summary);
}

async function triggerFlightDispatch(bookingId: string, option: FlightBookingOption): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId)!;
  const airlineEmail = "airline@example.com";

  const emailResult = await sendFlightReservationEmail({
    airlineEmail,
    airlineName: option.airline,
    guestName: booking.customer.name,
    passport: booking.customer.passport,
    nationality: booking.customer.nationality,
    guestEmail: booking.customer.email,
    guestPhone: booking.customer.phone,
    flightNumber: option.flightNumber,
    origin: option.origin,
    destination: option.destination,
    departureDate: option.departureDate,
    returnDate: option.returnDate || "",
    cabinClass: option.cabinClass,
    passengers: booking.flightDetails?.passengers || 1,
    totalPrice: option.totalPrice,
    currency: "USD",
  });

  if (emailResult.success) {
    addMsg(bookingId, "system", `Email sent to ${emailResult.sentTo} via Resend (ID: ${emailResult.emailId})`);
  } else {
    addMsg(bookingId, "system", `Email to ${emailResult.sentTo} failed: ${emailResult.error}`);
  }

  store.createTransaction({
    id: uuid(), bookingId, selectedOptionId: option.id,
    documentUrl: null, sentAt: new Date().toISOString(),
    confirmedAt: null, confirmationCode: null, status: "sent",
  });
  store.updateBooking(bookingId, { status: "sent_to_hotel" });
  simulateFlightResponse(bookingId);

  const completed = [...(booking.completedCategories || []), "flight" as BookingCategory];
  const updatedBooking = store.getBooking(bookingId)!;
  const tx = store.getLatestTransaction(bookingId);
  const code = tx?.confirmationCode ?? "";
  const confirmedSummary: ConfirmedBookingSummary = {
    category: "flight",
    providerName: `${option.airline} ${option.flightNumber}`,
    details: `${option.origin} → ${option.destination}, ${option.cabinClass}`,
    totalPrice: option.totalPrice,
    confirmationCode: code,
  };
  store.updateBooking(bookingId, {
    completedCategories: completed,
    confirmedBookings: [...(booking.confirmedBookings || []), confirmedSummary],
  });

  const emailNote = emailResult.success
    ? `The booking details have been sent to **${option.airline}**.`
    : `The booking was prepared for **${option.airline}**, but the email couldn't be delivered right now. Our team will follow up manually.`;

  const summary = `${emailNote}\n\nHere's your summary:\n- Passenger: ${updatedBooking.customer.name}\n- Flight: ${option.airline} ${option.flightNumber}\n- Route: ${option.origin} → ${option.destination}\n- Class: ${option.cabinClass}\n- Total: $${option.totalPrice}` +
    (code ? `\n- Confirmation Code: **${code}**` : "");

  const remaining = getRemainingCategories(store.getBooking(bookingId)!);
  if (remaining.length > 0) {
    const intro = crossPopulateNextCategory(store.getBooking(bookingId)!, remaining[0]);
    return text(`${summary}\n\n---\n\n${intro}`);
  }

  return text(summary);
}

async function triggerRestaurantDispatch(bookingId: string, option: RestaurantBookingOption): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId)!;
  const restaurantEmail = "restaurant@example.com";
  const rd = booking.restaurantDetails;

  const emailResult = await sendRestaurantReservationEmail({
    restaurantEmail,
    restaurantName: option.restaurantName,
    guestName: booking.customer.name,
    guestEmail: booking.customer.email,
    guestPhone: booking.customer.phone,
    date: rd?.date || "",
    time: rd?.time || "",
    partySize: rd?.partySize || 2,
    cuisine: option.cuisine,
    specialRequests: booking.preferences.specialRequests,
  });

  if (emailResult.success) {
    addMsg(bookingId, "system", `Email sent to ${emailResult.sentTo} via Resend (ID: ${emailResult.emailId})`);
  } else {
    addMsg(bookingId, "system", `Email to ${emailResult.sentTo} failed: ${emailResult.error}`);
  }

  store.createTransaction({
    id: uuid(), bookingId, selectedOptionId: option.id,
    documentUrl: null, sentAt: new Date().toISOString(),
    confirmedAt: null, confirmationCode: null, status: "sent",
  });
  store.updateBooking(bookingId, { status: "sent_to_hotel" });
  simulateRestaurantResponse(bookingId);

  const completed = [...(booking.completedCategories || []), "restaurant" as BookingCategory];
  const updatedBooking = store.getBooking(bookingId)!;
  const tx = store.getLatestTransaction(bookingId);
  const code = tx?.confirmationCode ?? "";
  const confirmedSummary: ConfirmedBookingSummary = {
    category: "restaurant",
    providerName: option.restaurantName,
    details: `${option.cuisine}, ${rd?.date || "TBD"} at ${rd?.time || "TBD"}`,
    totalPrice: option.totalPrice,
    confirmationCode: code,
  };
  store.updateBooking(bookingId, {
    completedCategories: completed,
    confirmedBookings: [...(booking.confirmedBookings || []), confirmedSummary],
  });

  const emailNote = emailResult.success
    ? `The reservation has been sent to **${option.restaurantName}**.`
    : `The reservation was prepared for **${option.restaurantName}**, but the email couldn't be delivered right now. Our team will follow up manually.`;

  const summary = `${emailNote}\n\nHere's your summary:\n- Guest: ${updatedBooking.customer.name}\n- Restaurant: ${option.restaurantName} (${option.cuisine})\n- Date: ${rd?.date || "TBD"} at ${rd?.time || "TBD"}\n- Party size: ${rd?.partySize || 2}` +
    (code ? `\n- Confirmation Code: **${code}**` : "");

  const remaining = getRemainingCategories(store.getBooking(bookingId)!);
  if (remaining.length > 0) {
    const intro = crossPopulateNextCategory(store.getBooking(bookingId)!, remaining[0]);
    return text(`${summary}\n\n---\n\n${intro}`);
  }

  return text(summary);
}

// ─── Phase: Sent to hotel — handle "more info needed" replies ───────────────

async function handleSentToHotel(
  booking: BookingRequest,
  customerMessage: string,
): Promise<WorkflowResult> {
  const tx = store.getLatestTransaction(booking.id);

  // If hotel asked for more info and customer is responding
  if (tx && tx.hotelResponseType === "more_info_needed") {
    addMsg(booking.id, "system", `Customer provided additional info: "${customerMessage}"`);

    // Reset the transaction state so the simulator can act again
    store.updateTransaction(tx.id, { hotelResponseType: undefined, hotelMessage: undefined });

    // Re-simulate (always confirms now)
    simulateHotelResponse(booking.id);

    return text(
      "Thank you for providing that information! I've forwarded it to the hotel. We should hear back shortly."
    );
  }

  // Default: still waiting for initial hotel response
  return text(
    "Your reservation has been sent to the hotel. We're waiting for their confirmation — I'll let you know as soon as we hear back!"
  );
}

// ─── Cancellation flow ──────────────────────────────────────────────���───────

const CANCELABLE_STATES: string[] = [
  "intake", "extracting", "matching", "options_presented",
  "selected", "collecting_info", "awaiting_payment", "filling_template", "sent_to_hotel",
];

const YES_PATTERN = /\b(yes|yeah|yep|sure|confirm|go\s*ahead|do\s*it|cancel\s*it|proceed)\b/i;
const NO_PATTERN = /\b(no|nah|nope|wait|don'?t|keep|continue|go\s*back|stop)\b/i;

/**
 * Shared cancellation service — used by both customer chat flow and operator API.
 */
export async function cancelBooking(
  bookingId: string,
  reason: string,
  opts: { force?: boolean; sendEmail?: boolean; source: "customer" | "operator" },
): Promise<{ success: boolean; error?: string }> {
  const booking = store.getBooking(bookingId);
  if (!booking) return { success: false, error: "Booking not found" };
  if (booking.status === "cancelled") return { success: false, error: "Booking is already cancelled" };
  if (booking.status === "confirmed" && !opts.force) {
    return { success: false, error: "Booking is confirmed. Pass force to cancel." };
  }

  // Cancel any active transaction
  const tx = store.getLatestTransaction(bookingId);
  if (tx && tx.status === "sent") {
    store.updateTransaction(tx.id, { status: "rejected" });
  }

  // Send cancellation email to provider if reservation was dispatched
  if (opts.sendEmail && ["sent_to_hotel", "confirmed"].includes(booking.status)) {
    const selectedOption = tx ? store.getOptions(bookingId).find((o) => o.id === tx.selectedOptionId) : null;

    if (selectedOption && selectedOption.category === "hotel") {
      const hotel = await fetchHotelById(selectedOption.hotelId);
      if (hotel) {
        const emailResult = await sendCancellationEmail({
          hotelEmail: hotel.contactEmail,
          hotelName: hotel.name,
          guestName: booking.customer.name,
          roomType: selectedOption.roomType.name,
          checkIn: booking.travel.checkIn,
          checkOut: booking.travel.checkOut,
          confirmationCode: tx?.confirmationCode,
          bookingId,
        });
        addMsg(bookingId, "system",
          emailResult.success
            ? `Cancellation email sent to ${emailResult.sentTo} (ID: ${emailResult.emailId})`
            : `Cancellation email to ${emailResult.sentTo} failed: ${emailResult.error}`,
        );
      }
    } else if (selectedOption) {
      // For flights/restaurants, log the cancellation (emails can be added later)
      addMsg(bookingId, "system", `Cancellation processed for ${selectedOption.category} booking.`);
    }
  }

  store.updateBooking(bookingId, { status: "cancelled", cancelRequested: false });
  addMsg(bookingId, "system", `Booking cancelled. Reason: ${reason}. Source: ${opts.source}`);

  return { success: true };
}

function enterCancelConfirmation(booking: BookingRequest): WorkflowResult {
  store.updateBooking(booking.id, { cancelRequested: true });

  if (booking.status === "sent_to_hotel") {
    const tx = store.getLatestTransaction(booking.id);
    const option = tx ? store.getOptions(booking.id).find((o) => o.id === tx.selectedOptionId) : null;
    const providerName = option
      ? (option.category === "hotel" ? option.hotelName : option.category === "flight" ? (option as FlightBookingOption).airline : (option as RestaurantBookingOption).restaurantName)
      : "the provider";
    return text(
      `Are you sure you'd like to cancel? A reservation request has already been sent to **${providerName}**. I'll need to notify them of the cancellation.\n\nPlease reply **yes** or **no**.`
    );
  }

  if (booking.status === "confirmed") {
    const tx = store.getLatestTransaction(booking.id);
    const code = tx?.confirmationCode || "N/A";
    return text(
      `This booking is already confirmed with code **${code}**. Cancelling at this stage may have implications.\n\nAre you sure you want to cancel? Please reply **yes** or **no**.`
    );
  }

  // Pre-dispatch states
  return text(
    "Are you sure you'd like to cancel this booking? No reservation has been sent yet, so there's nothing to undo.\n\nPlease reply **yes** or **no**."
  );
}

async function handleCancelConfirmation(
  booking: BookingRequest,
  customerMessage: string,
): Promise<WorkflowResult> {
  if (YES_PATTERN.test(customerMessage)) {
    const postDispatch = ["sent_to_hotel", "confirmed"].includes(booking.status);
    const result = await cancelBooking(booking.id, "Cancelled by customer", {
      force: booking.status === "confirmed",
      sendEmail: postDispatch,
      source: "customer",
    });

    if (!result.success) {
      store.updateBooking(booking.id, { cancelRequested: false });
      return text(`I couldn't cancel the booking: ${result.error}. Let's continue where we left off.`);
    }

    return postDispatch
      ? text("Your booking has been cancelled and the hotel has been notified. If you change your mind, feel free to start a new booking anytime!")
      : text("Your booking has been cancelled. If you change your mind, feel free to start a new booking anytime!");
  }

  if (NO_PATTERN.test(customerMessage)) {
    store.updateBooking(booking.id, { cancelRequested: false });
    return text("Okay, let's continue where we left off! What would you like to do?");
  }

  // Ambiguous
  return text("I want to make sure — would you like to cancel this booking? Please reply **yes** or **no**.");
}

// ─── Main entry point ───────────────────────────────────────────────────────

export async function processMessage(
  bookingId: string,
  customerMessage: string,
  metadata?: MessageMetadata,
): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId);
  if (!booking) return text("Booking not found.");

  // ── Cancel confirmation pending — handle yes/no before anything else ──
  if (booking.cancelRequested) {
    return handleCancelConfirmation(booking, customerMessage);
  }

  // ── Direct option selection from web UI click ──
  if (metadata?.type === "option_selected") {
    return selectOption(bookingId, metadata.optionIndex);
  }

  // ── Pre-routing cancel intent detection (regex, no LLM call) ──
  if (CANCELABLE_STATES.includes(booking.status)) {
    const cancelCheck = detectCancelIntent(customerMessage);
    if (cancelCheck.intent === "cancel") {
      return enterCancelConfirmation(booking);
    }
  }

  // ── Detect booking category at intake if not yet set ──
  if (booking.status === "intake" && !booking.category) {
    const { categories } = await detectCategory(customerMessage);
    if (categories.length > 0) {
      const first = categories[0];
      store.updateBooking(booking.id, {
        category: first,
        activeCategory: first,
        categories: categories,
        completedCategories: [],
      });
      if (categories.length > 1) {
        addMsg(booking.id, "system", `Categories detected: ${categories.join(", ")}. Starting with ${first}.`);
      } else {
        addMsg(booking.id, "system", `Category detected: ${first}`);
      }
    } else {
      return text("I can help you book a hotel, flight, or restaurant reservation — or all of them at once! Which would you like?");
    }
  }

  // Re-read booking after potential category/status updates above
  const current = store.getBooking(bookingId)!;

  // ── When confirmed: check for remaining categories or offer others ──
  if (current.status === "confirmed") {
    return handlePostConfirmation(current, customerMessage);
  }

  // ── Route based on current workflow state ──
  switch (current.status) {
    case "intake":
    case "extracting":
      return handleCollectingPreferences(current, customerMessage);

    case "matching":
      return handleMatching(current.id);

    case "options_presented":
      return handleAwaitingSelectionText(current, customerMessage);

    case "selected":
    case "collecting_info":
      return handleCollectingInfo(current, customerMessage);

    case "awaiting_payment":
      return text("I'm waiting for your payment confirmation from Stripe. Once you complete the payment at the link I sent, I'll proceed with your reservation.");

    case "sent_to_hotel":
      return handleSentToHotel(current, customerMessage);

    case "cancelled":
      return text("This booking has been cancelled. Would you like to start a new booking?");

    default:
      return text("I'm not sure what to do next. Let me connect you with an operator.");
  }
}

// ─── Post-confirmation: transition to next category or offer others ────────

async function handlePostConfirmation(
  booking: BookingRequest,
  customerMessage: string,
): Promise<WorkflowResult> {
  // Check if there are remaining categories from the original multi-booking request
  const remaining = getRemainingCategories(booking);

  if (remaining.length > 0) {
    // Auto-transition with smart cross-population
    const result = transitionToNextCategory(booking);
    if (result) return result;
  }

  // No remaining pre-selected categories — check if user wants to book something else
  const completed = booking.completedCategories || [];
  const allCategories: BookingCategory[] = ["hotel", "flight", "restaurant"];
  const available = allCategories.filter((c) => !completed.includes(c));

  if (available.length === 0) {
    return text("All three booking types are confirmed! Is there anything else I can help you with?");
  }

  // Try to detect if the user is requesting a new category
  const { categories } = await detectCategory(customerMessage);
  const newCategories = categories.filter((c) => !completed.includes(c));

  if (newCategories.length > 0) {
    // Add new categories and cross-populate from existing data
    const first = newCategories[0];
    const allNew = [...(booking.categories || []), ...newCategories.filter((c) => !(booking.categories || []).includes(c))];
    store.updateBooking(booking.id, { categories: allNew });
    addMsg(booking.id, "system", `Adding ${newCategories.join(", ")} to booking`);

    const intro = crossPopulateNextCategory(store.getBooking(booking.id)!, first);
    return text(intro);
  }

  // Contextual follow-up — offer what's available using known data
  const lastCategory = getActiveCategory(booking);
  const dest = booking.travel.destination || booking.flightDetails?.destination || booking.restaurantDetails?.location || "";
  const offers: string[] = [];
  if (available.includes("flight")) {
    offers.push(dest ? `a **flight** to ${dest}` : "a **flight**");
  }
  if (available.includes("hotel")) {
    offers.push(dest ? `a **hotel** in ${dest}` : "a **hotel**");
  }
  if (available.includes("restaurant")) {
    offers.push(dest ? `a **restaurant** reservation in ${dest}` : "a **restaurant** reservation");
  }

  return text(`Your ${categoryLabel(lastCategory)} is all set! Would you also like me to book ${offers.join(" or ")}?`);
}
