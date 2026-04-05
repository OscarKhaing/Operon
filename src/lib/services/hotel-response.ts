/**
 * Simulates hotel email responses to reservation requests.
 * Currently always confirms deterministically (no random outcomes).
 * Failure handlers are retained for use when real hotel responses
 * replace the simulation.
 *
 * Replace with real email parsing / webhook ingestion in production.
 */
import { store } from "../store";
import { ChatMessage, MessageMetadata } from "../types";
import { v4 as uuid } from "uuid";

// ─── Response pools ─────────────────────────────────────────────────────────

const MORE_INFO_REQUESTS = [
  "Please provide the estimated arrival time for the guest.",
  "A credit card number is required to guarantee the reservation.",
  "Could you confirm the guest's dietary preferences for the included breakfast?",
  "We require a scanned copy of the guest's passport for registration purposes.",
  "Please confirm whether the guest requires airport transfer arrangements.",
  "We need to know if a late check-out (after 12pm) is required.",
];

const NO_AVAILABILITY_REASONS = [
  "Unfortunately, the requested room type is fully booked for those dates.",
  "We are at full capacity for the selected period due to a local event.",
  "The room category you requested is under renovation during those dates.",
  "We regret that we cannot accommodate the reservation for the requested period.",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function addMsg(
  bookingId: string,
  role: ChatMessage["role"],
  content: string,
  metadata?: MessageMetadata,
): void {
  const msg: ChatMessage = {
    id: uuid(),
    bookingId,
    role,
    content,
    timestamp: new Date().toISOString(),
    metadata: metadata ?? undefined,
  };
  store.addMessage(msg);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Main simulator ─────────────────────────────────────────────────────────

/**
 * Simulates a hotel response synchronously.
 * Always confirms the reservation — no random outcomes.
 */
export function simulateHotelResponse(bookingId: string): void {
  const booking = store.getBooking(bookingId);
  if (!booking || booking.status !== "sent_to_hotel") return;
  const tx = store.getLatestTransaction(bookingId);
  if (!tx) return;
  handleConfirmed(bookingId, tx.id);
}

/**
 * Simulates an airline response synchronously. Always confirms.
 */
export function simulateFlightResponse(bookingId: string): void {
  const booking = store.getBooking(bookingId);
  if (!booking || booking.status !== "sent_to_hotel") return;
  const tx = store.getLatestTransaction(bookingId);
  if (!tx) return;
  handleConfirmed(bookingId, tx.id);
}

/**
 * Simulates a restaurant response synchronously. Always confirms.
 */
export function simulateRestaurantResponse(bookingId: string): void {
  const booking = store.getBooking(bookingId);
  if (!booking || booking.status !== "sent_to_hotel") return;
  const tx = store.getLatestTransaction(bookingId);
  if (!tx) return;
  handleConfirmed(bookingId, tx.id);
}

// ─── Response handlers ──────────────────────────────────────────────────────

function handleConfirmed(bookingId: string, transactionId: string): void {
  const code = `CONF-${Date.now().toString(36).toUpperCase()}`;
  const message = `Reservation confirmed. Your confirmation code is ${code}.`;

  store.updateTransaction(transactionId, {
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
    confirmationCode: code,
    hotelResponseType: "confirmed",
    hotelMessage: message,
  });

  store.updateBooking(bookingId, { status: "confirmed" });

  addMsg(bookingId, "system", `Hotel confirmed! Code: ${code}`, {
    type: "hotel_response",
    responseType: "confirmed",
    message,
  });

  addMsg(
    bookingId,
    "agent",
    `Great news! The hotel has confirmed your reservation. Your confirmation code is **${code}**. You're all set!`,
  );
}

export function handleMoreInfoNeeded(bookingId: string, transactionId: string): void {
  const tx = store.getLatestTransaction(bookingId);
  const retryCount = (tx?.retryCount ?? 0);

  // Cap retries — after 2 attempts, escalate to operator
  if (retryCount >= 2) {
    const escalationMsg = "The hotel has requested additional information multiple times. This booking needs operator attention.";
    addMsg(bookingId, "system", escalationMsg, {
      type: "hotel_response",
      responseType: "more_info_needed",
      message: escalationMsg,
    });
    return;
  }

  const request = pick(MORE_INFO_REQUESTS);
  const message = `The hotel needs additional information: "${request}"`;

  store.updateTransaction(transactionId, {
    hotelResponseType: "more_info_needed",
    hotelMessage: request,
    retryCount: retryCount + 1,
  });

  addMsg(bookingId, "system", message, {
    type: "hotel_response",
    responseType: "more_info_needed",
    message: request,
  });

  addMsg(
    bookingId,
    "agent",
    `The hotel has responded with a question before confirming: **${request}**\n\nCould you please provide this information?`,
  );
}

export function handleNoAvailability(bookingId: string, transactionId: string): void {
  const reason = pick(NO_AVAILABILITY_REASONS);
  const message = `Hotel declined: ${reason}`;

  store.updateTransaction(transactionId, {
    status: "rejected",
    hotelResponseType: "no_availability",
    hotelMessage: reason,
  });

  // Track rejected option so it's excluded from re-presentation
  const tx = store.getLatestTransaction(bookingId);
  const booking = store.getBooking(bookingId);
  if (booking && tx) {
    const rejected = booking.rejectedOptionIds ?? [];
    if (!rejected.includes(tx.selectedOptionId)) {
      rejected.push(tx.selectedOptionId);
    }
    store.updateBooking(bookingId, {
      status: "options_presented",
      rejectedOptionIds: rejected,
    });
  }

  addMsg(bookingId, "system", message, {
    type: "hotel_response",
    responseType: "no_availability",
    message: reason,
  });

  // Re-present remaining options
  const options = store.getOptions(bookingId);
  const rejectedIds = store.getBooking(bookingId)?.rejectedOptionIds ?? [];
  const remaining = options.filter((o) => !rejectedIds.includes(o.id));

  if (remaining.length > 0) {
    const optionsList = remaining
      .slice(0, 5)
      .map((opt, i) => {
        if (opt.category === "hotel") {
          return `${i + 1}. **${opt.hotelName} - ${opt.roomType.name}** — $${opt.roomType.basePrice}/night ($${opt.totalPrice} total)`;
        }
        return `${i + 1}. Option — $${opt.totalPrice} total`;
      })
      .join("\n");

    addMsg(
      bookingId,
      "agent",
      `Unfortunately, the hotel couldn't accommodate your reservation: *${reason}*\n\nHere are your remaining options:\n\n${optionsList}\n\nWhich would you like to go with?`,
    );
  } else {
    addMsg(
      bookingId,
      "agent",
      `Unfortunately, the hotel couldn't accommodate your reservation: *${reason}*\n\nAll options for your selected criteria have been exhausted. Would you like to adjust your preferences and search again?`,
    );
    store.updateBooking(bookingId, { status: "extracting" });
  }
}

