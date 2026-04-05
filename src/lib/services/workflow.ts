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
import { BookingRequest, ChatMessage, BookingOption, MessageMetadata, HotelOptionCard } from "../types";
import { findOptions } from "./matching";
import {
  extractPreferences,
  generatePreferenceReply,
  presentOptions,
  parseSelection,
  extractPersonalInfo,
  generateChecklistReply,
  detectCancelIntent,
} from "./llm";
import { generateDummyPdf } from "./pdf-dummy";
import { sendReservationEmail, sendCancellationEmail } from "./email";
import { simulateHotelResponse } from "./hotel-response";
import { fetchHotelById, fetchHotels, fetchAvailableLocations } from "./hotel-api";
import { createCheckoutSession } from "./stripe";
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

// ─── Phase: Collect booking preferences ─────────────────────────────────────

// Only destination + dates are required to search. The rest are optional filters.
const REQUIRED_PREF_FIELDS = ["destination", "checkIn", "checkOut"] as const;
const ALL_PREF_FIELDS = ["destination", "checkIn", "checkOut", "guestCount", "roomType", "maxBudget"] as const;

async function handleCollectingPreferences(
  booking: BookingRequest,
  _customerMessage: string
): Promise<WorkflowResult> {
  const convo = recentConversation(booking.id);

  // Fetch available locations for LLM to match against
  const availableLocations = await fetchAvailableLocations();

  // LLM extraction with location list for standardization
  const prefs = await extractPreferences(convo, availableLocations);

  // Merge extraction into booking (only non-null fields)
  const travelUpdates: Record<string, unknown> = {};
  if (prefs.checkIn) travelUpdates.checkIn = prefs.checkIn;
  if (prefs.checkOut) travelUpdates.checkOut = prefs.checkOut;
  if (prefs.guestCount) travelUpdates.guestCount = prefs.guestCount;

  // Handle destination separately — detect changes for hotel cache management
  const previousDestination = booking.travel.destination;
  if (prefs.destination) {
    travelUpdates.destination = prefs.destination;

    // If destination changed, clear cached hotels so we re-fetch for new location
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

  // Pre-load hotels for the resolved destination (partial DB retrieval)
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
      // Destination doesn't match any hotel in our pool — tell the customer early
      addMsg(booking.id, "system", `No hotels in pool for: ${resolvedDestination}`);
      // Clear the destination so they can try again
      store.updateBooking(booking.id, {
        travel: { ...store.getBooking(booking.id)!.travel, destination: "" },
      });
      return text(
        `Unfortunately, we don't have contracted hotels in ${resolvedDestination} at the moment. ` +
        `Our current destinations include: ${availableLocations.join(", ")}.\n\n` +
        `Would you like to choose one of these, or I can recommend checking Booking.com or Agoda for ${resolvedDestination}?`
      );
    }
  }

  // Log extraction
  const extracted = Object.entries(prefs)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  if (extracted) {
    addMsg(booking.id, "system", `Extracted preferences: ${extracted}`);
  }

  // ── Determine what's known vs missing ──
  const updated = store.getBooking(booking.id)!;
  const knownFields: Record<string, string | number | null> = {
    destination: updated.travel.destination || null,
    checkIn: updated.travel.checkIn || null,
    checkOut: updated.travel.checkOut || null,
    guestCount: updated.travel.guestCount > 0 ? updated.travel.guestCount : null,
    roomType: updated.preferences.roomType || null,
    maxBudget: updated.preferences.maxBudgetPerNight > 0 ? updated.preferences.maxBudgetPerNight : null,
  };
  const requiredMissing = REQUIRED_PREF_FIELDS.filter((f) => knownFields[f] === null || knownFields[f] === undefined);
  const optionalMissing = ALL_PREF_FIELDS.filter(
    (f) => !REQUIRED_PREF_FIELDS.includes(f as typeof REQUIRED_PREF_FIELDS[number]) && (knownFields[f] === null || knownFields[f] === undefined)
  );

  if (requiredMissing.length === 0) {
    store.updateBooking(booking.id, { status: "matching" });
    return handleMatching(booking.id);
  }

  store.updateBooking(booking.id, { status: "extracting" });
  const allMissing = [...requiredMissing, ...optionalMissing];
  const reply = await generatePreferenceReply(convo, knownFields, allMissing);
  return text(reply);
}

// ─── Phase: Hotel matching (rule-based) + LLM presentation ─────────────────

async function handleMatching(bookingId: string): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId)!;
  const cachedHotels = store.getHotelCache(bookingId);
  const { options, hotelMap } = await findOptions(booking, cachedHotels);
  store.addOptions(options);

  if (options.length === 0) {
    store.updateBooking(bookingId, { status: "extracting" });
    return text("I couldn't find any hotels matching your criteria in our contracted pool. Could you consider a different destination, adjust your dates, or increase your budget?");
  }

  store.updateBooking(bookingId, { status: "options_presented" });

  // System log
  addMsg(bookingId, "system", `Found ${options.length} options. Top score: ${options[0].score}`);

  // Build structured option cards for web UI
  const top = options.slice(0, 5);
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

  // Also generate plain-text version via LLM (for WhatsApp / fallback)
  const customerName = booking.customer.name || "there";
  const plainText = await presentOptions(
    customerName,
    booking.travel.destination,
    optionCards.map((o, i) => ({ number: i + 1, ...o }))
  );

  return {
    content: plainText,
    metadata: { type: "hotel_options", options: optionCards },
  };
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

  const options = store.getOptions(bookingId);
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
  const options = store.getOptions(booking.id);
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

  addMsg(
    booking.id,
    "system",
    `Customer selected option ${displayNumber}: ${chosen.hotelName} - ${chosen.roomType.name} ($${chosen.totalPrice})`
  );

  store.updateBooking(booking.id, { status: "collecting_info" });

  return text(
    `Great choice! You've selected **${chosen.hotelName} - ${chosen.roomType.name}** at $${chosen.roomType.basePrice}/night ($${chosen.totalPrice} total).\n\nTo complete the reservation, I'll need a few personal details. Could you please provide:\n1. Your full name (as on passport)\n2. Passport number\n3. Nationality\n4. Email address\n5. Phone number`
  );
}

// ─── Phase: Collect personal info via checklist ─────────────────────────────

const PERSONAL_FIELDS = ["name", "passport", "nationality", "email", "phone"] as const;

async function handleCollectingInfo(
  booking: BookingRequest,
  customerMessage: string
): Promise<WorkflowResult> {
  // LLM extraction of personal info from latest message
  const extracted = await extractPersonalInfo(customerMessage);

  // Merge into booking customer — only fill empty fields to prevent LLM overwrites
  const customerUpdates: Record<string, string> = {};
  if (extracted.name && !booking.customer.name) customerUpdates.name = extracted.name;
  if (extracted.passport && !booking.customer.passport) customerUpdates.passport = extracted.passport;
  if (extracted.nationality && !booking.customer.nationality) customerUpdates.nationality = extracted.nationality;
  if (extracted.email && !booking.customer.email) customerUpdates.email = extracted.email;
  if (extracted.phone && !booking.customer.phone) customerUpdates.phone = extracted.phone;

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
    passport: updated.customer.passport || null,
    nationality: updated.customer.nationality || null,
    email: updated.customer.email || null,
    phone: updated.customer.phone || null,
  };
  const missing = PERSONAL_FIELDS.filter((f) => !collected[f]);

  if (missing.length === 0) {
    // All personal info collected! → create payment session
    addMsg(booking.id, "system", "All personal info collected. Creating payment link...");

    const options = store.getOptions(booking.id);
    const selectedOption = booking.selectedOptionId
      ? options.find((option) => option.id === booking.selectedOptionId)
      : options[0];
    if (!selectedOption) {
      return text("I couldn't find your selected option. Please choose an option again.");
    }

    const { url, sessionId } = await createCheckoutSession({
      bookingId: booking.id,
      totalPrice: selectedOption.totalPrice,
      hotelName: selectedOption.hotelName,
      roomType: selectedOption.roomType.name,
      checkIn: booking.travel.checkIn,
      checkOut: booking.travel.checkOut,
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
      `Almost there! To confirm your reservation at **${selectedOption.hotelName}**, please complete your payment of **$${selectedOption.totalPrice}** using this secure link:\n\n${url}\n\nOnce payment is complete, I'll send the reservation to the hotel immediately.`
    );
  }

  // Still collecting — LLM generates natural follow-up
  const convoSnippet = recentConversation(booking.id, 4);
  const reply = await generateChecklistReply(convoSnippet, collected, missing);
  return text(reply);
}

// ─── Dispatch: dummy PDF + real email via Resend ────────────────────────────

export async function triggerDispatch(bookingId: string, option: BookingOption): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId)!;
  const hotel = await fetchHotelById(option.hotelId);
  const hotelEmail = hotel?.contactEmail || "hotel@example.com";

  // 1. Generate dummy PDF (replace with real PDF generation later)
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

  // 2. Send reservation email to hotel via Resend
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

  // 3. Create transaction record and update booking status
  store.createTransaction({
    id: uuid(),
    bookingId,
    selectedOptionId: option.id,
    documentUrl: pdfResult.pdfPath,
    sentAt: new Date().toISOString(),
    confirmedAt: null,
    confirmationCode: null,
    status: "sent",
  });
  store.updateBooking(bookingId, { status: "sent_to_hotel" });

  // 4. Simulate hotel response (confirmed / more info needed / no availability)
  simulateHotelResponse(bookingId);

  // The simulation runs synchronously above and always confirms,
  // so the booking is already in "confirmed" state. Return a
  // summary without a duplicate confirmation message (the
  // simulator already added its own agent + system messages).
  const updatedBooking = store.getBooking(bookingId)!;
  const tx2 = store.getLatestTransaction(bookingId);
  const confirmationCode = tx2?.confirmationCode ?? "";

  const emailNote = emailResult.success
    ? `The reservation details have been sent to **${option.hotelName}** (${hotelEmail}).`
    : `The reservation was prepared for **${option.hotelName}**, but the email couldn't be delivered right now. Our team will follow up manually.`;

  return text(
    `${emailNote}\n\nHere's your summary:\n- Guest: ${updatedBooking.customer.name}\n- Hotel: ${option.hotelName} - ${option.roomType.name}\n- Dates: ${updatedBooking.travel.checkIn} to ${updatedBooking.travel.checkOut}\n- Total: $${option.totalPrice}` +
    (confirmationCode ? `\n- Confirmation Code: **${confirmationCode}**` : "") +
    `\n\nYou're all set!`
  );
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

  // Send cancellation email to hotel if reservation was dispatched
  if (opts.sendEmail && ["sent_to_hotel", "confirmed"].includes(booking.status)) {
    const selectedOption = tx ? store.getOptions(bookingId).find((o) => o.id === tx.selectedOptionId) : null;
    const hotel = selectedOption ? await fetchHotelById(selectedOption.hotelId) : null;

    if (hotel && selectedOption) {
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

      addMsg(
        bookingId,
        "system",
        emailResult.success
          ? `Cancellation email sent to ${emailResult.sentTo} (ID: ${emailResult.emailId})`
          : `Cancellation email to ${emailResult.sentTo} failed: ${emailResult.error}`,
      );
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
    const hotelName = option?.hotelName || "the hotel";
    return text(
      `Are you sure you'd like to cancel? A reservation request has already been sent to **${hotelName}**. I'll need to notify them of the cancellation.\n\nPlease reply **yes** or **no**.`
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
  // Bypasses LLM entirely — deterministic, instant.
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

  // ── Route based on current workflow state ──
  switch (booking.status) {
    case "intake":
    case "extracting":
      return handleCollectingPreferences(booking, customerMessage);

    case "matching":
      return handleMatching(booking.id);

    case "options_presented":
      return handleAwaitingSelectionText(booking, customerMessage);

    case "selected":
    case "collecting_info":
      return handleCollectingInfo(booking, customerMessage);

    case "awaiting_payment":
      return text("I'm waiting for your payment confirmation from Stripe. Once you complete the payment at the link I sent, I'll proceed with your reservation.");

    case "sent_to_hotel":
      return handleSentToHotel(booking, customerMessage);

    case "confirmed":
      return text("Your booking is confirmed! Is there anything else I can help you with?");

    case "cancelled":
      return text("This booking has been cancelled. Would you like to start a new booking?");

    default:
      return text("I'm not sure what to do next. Let me connect you with an operator.");
  }
}
