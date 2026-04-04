import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ChatMessage } from "@/lib/types";
import { extractFromMessages, generateFollowUp } from "@/lib/services/extraction";
import { findOptions } from "@/lib/services/matching";
import { v4 as uuid } from "uuid";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }
  return NextResponse.json(store.getMessages(bookingId));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { bookingId, content } = body;

  if (!bookingId || !content) {
    return NextResponse.json({ error: "bookingId and content required" }, { status: 400 });
  }

  // Save customer message
  const customerMsg: ChatMessage = {
    id: uuid(),
    bookingId,
    role: "customer",
    content,
    timestamp: new Date().toISOString(),
  };
  store.addMessage(customerMsg);

  // Get all messages for this booking to run extraction
  const allMessages = store.getMessages(bookingId);
  const customerTexts = allMessages
    .filter((m) => m.role === "customer")
    .map((m) => m.content);

  const extraction = extractFromMessages(customerTexts);

  // System message showing extraction
  const extractedFields = Object.entries({
    ...extraction.customer,
    ...extraction.travel,
    ...extraction.preferences,
  })
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  if (extractedFields) {
    const sysMsg: ChatMessage = {
      id: uuid(),
      bookingId,
      role: "system",
      content: `Extracted: ${extractedFields}`,
      timestamp: new Date().toISOString(),
    };
    store.addMessage(sysMsg);
  }

  // Update booking with extracted data
  const booking = store.getBooking(bookingId);
  if (booking) {
    const updates: Record<string, unknown> = {};
    if (extraction.customer.name) updates.customer = { ...booking.customer, ...extraction.customer };
    if (extraction.travel.destination) updates.travel = { ...booking.travel, ...extraction.travel };
    if (extraction.preferences.roomType) updates.preferences = { ...booking.preferences, ...extraction.preferences };

    if (Object.keys(updates).length > 0) {
      store.updateBooking(bookingId, updates as Partial<typeof booking>);
    }
  }

  // Generate agent response
  let agentContent: string;

  if (extraction.missingFields.length > 0) {
    agentContent = generateFollowUp(extraction.missingFields);
    if (booking) store.updateBooking(bookingId, { status: "extracting" });
  } else {
    // All info collected — find options
    const updatedBooking = store.getBooking(bookingId);
    if (updatedBooking) {
      store.updateBooking(bookingId, { status: "matching" });
      const options = findOptions(updatedBooking);
      store.addOptions(options);

      if (options.length === 0) {
        agentContent = "I couldn't find any hotels matching your criteria. Would you like to adjust your destination, dates, or budget?";
      } else {
        store.updateBooking(bookingId, { status: "options_presented" });
        const optionsList = options
          .slice(0, 5)
          .map(
            (opt, i) =>
              `${i + 1}. **${opt.hotelName} - ${opt.roomType.name}** — $${opt.roomType.basePrice}/night ($${opt.totalPrice} total for ${opt.nightCount} nights)\n   ${opt.explanation}`
          )
          .join("\n\n");

        agentContent = `Great! I have all your details. Here are the best options:\n\n${optionsList}\n\nWhich option would you prefer?`;
      }
    } else {
      agentContent = "Something went wrong. Let me start over — what are you looking for?";
    }
  }

  const agentMsg: ChatMessage = {
    id: uuid(),
    bookingId,
    role: "agent",
    content: agentContent,
    timestamp: new Date().toISOString(),
  };
  store.addMessage(agentMsg);

  return NextResponse.json({
    customerMessage: customerMsg,
    agentMessage: agentMsg,
    extraction,
  });
}
