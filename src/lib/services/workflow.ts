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
} from "./llm";
import { generateDummyPdf } from "./pdf-dummy";
import { sendReservationEmail } from "./email";
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

const PREF_FIELDS = ["destination", "checkIn", "checkOut", "guestCount", "roomType", "maxBudget"] as const;

async function handleCollectingPreferences(
  booking: BookingRequest,
  _customerMessage: string
): Promise<WorkflowResult> {
  const convo = recentConversation(booking.id);

  // LLM extraction
  const prefs = await extractPreferences(convo);

  // Merge into booking
  const travelUpdates: Record<string, unknown> = {};
  if (prefs.destination) travelUpdates.destination = prefs.destination;
  if (prefs.checkIn) travelUpdates.checkIn = prefs.checkIn;
  if (prefs.checkOut) travelUpdates.checkOut = prefs.checkOut;
  if (prefs.guestCount) travelUpdates.guestCount = prefs.guestCount;

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

  // Log extraction
  const extracted = Object.entries(prefs)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  if (extracted) {
    addMsg(booking.id, "system", `Extracted preferences: ${extracted}`);
  }

  // Check what's missing
  const knownFields: Record<string, string | number | null> = {
    destination: prefs.destination,
    checkIn: prefs.checkIn,
    checkOut: prefs.checkOut,
    guestCount: prefs.guestCount,
    roomType: prefs.roomType,
    maxBudget: prefs.maxBudget,
  };
  const missing = PREF_FIELDS.filter((f) => knownFields[f] === null || knownFields[f] === undefined);

  if (missing.length === 0) {
    // All preferences collected — transition to matching
    store.updateBooking(booking.id, { status: "matching" });
    return handleMatching(booking.id);
  }

  // Still collecting — ask for missing
  store.updateBooking(booking.id, { status: "extracting" });
  const reply = await generatePreferenceReply(convo, knownFields, missing);
  return text(reply);
}

// ─── Phase: Hotel matching (rule-based) + LLM presentation ─────────────────

async function handleMatching(bookingId: string): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId)!;
  const options = findOptions(booking);
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
    stars: store.getHotel(o.hotelId)?.stars || 4,
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
  store.updateBooking(booking.id, { status: "selected" });

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
    // All personal info collected! → proceed to PDF + dispatch
    store.updateBooking(booking.id, { status: "filling_template" });
    addMsg(booking.id, "system", "All personal info collected. Generating reservation document...");

    // Trigger PDF + dispatch
    const options = store.getOptions(booking.id);
    const selectedOption = options[0]; // use first/selected
    return triggerDispatch(booking.id, selectedOption);
  }

  // Still collecting — LLM generates natural follow-up
  const convoSnippet = recentConversation(booking.id, 4);
  const reply = await generateChecklistReply(convoSnippet, collected, missing);
  return text(reply);
}

// ─── Dispatch: dummy PDF + real email via Resend ────────────────────────────

async function triggerDispatch(bookingId: string, option: BookingOption): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId)!;
  const hotel = store.getHotel(option.hotelId);
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

  // 3. Update booking status
  store.updateBooking(bookingId, { status: "sent_to_hotel" });

  // 4. Auto-simulate hotel confirmation (replace with real webhook/polling later)
  setTimeout(() => {
    const code = `CONF-${Date.now().toString(36).toUpperCase()}`;
    store.updateBooking(bookingId, { status: "confirmed" });
    addMsg(bookingId, "system", `Hotel confirmed! Code: ${code}`);
  }, 2000);

  const emailNote = emailResult.success
    ? `I've sent the reservation details to **${option.hotelName}** (${hotelEmail}).`
    : `I prepared the reservation for **${option.hotelName}**, but the email couldn't be delivered right now. Our team will follow up manually.`;

  return text(
    `All set! ${emailNote}\n\nHere's a summary:\n- Guest: ${booking.customer.name}\n- Hotel: ${option.hotelName} - ${option.roomType.name}\n- Dates: ${booking.travel.checkIn} to ${booking.travel.checkOut}\n- Total: $${option.totalPrice}\n\nThe hotel will confirm shortly. I'll notify you once confirmed!`
  );
}

// ─── Main entry point ───────────────────────────────────────────────────────

export async function processMessage(
  bookingId: string,
  customerMessage: string,
  metadata?: MessageMetadata,
): Promise<WorkflowResult> {
  const booking = store.getBooking(bookingId);
  if (!booking) return text("Booking not found.");

  // ── Direct option selection from web UI click ──
  // Bypasses LLM entirely — deterministic, instant.
  if (metadata?.type === "option_selected") {
    return selectOption(bookingId, metadata.optionIndex);
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

    case "sent_to_hotel":
      return text("Your reservation has been sent to the hotel. We're waiting for their confirmation — I'll let you know as soon as we hear back!");

    case "confirmed":
      return text("Your booking is confirmed! Is there anything else I can help you with?");

    case "cancelled":
      return text("This booking has been cancelled. Would you like to start a new booking?");

    default:
      return text("I'm not sure what to do next. Let me connect you with an operator.");
  }
}
