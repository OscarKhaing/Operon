/**
 * Demo-only endpoint: simulates Stripe payment completion.
 * Triggers dispatch for a booking that's in awaiting_payment status.
 */
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { triggerDispatch } from "@/lib/services/workflow";
import { ChatMessage } from "@/lib/types";
import { v4 as uuid } from "uuid";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const bookingId = body?.bookingId;

  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const booking = store.getBooking(bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "awaiting_payment") {
    return NextResponse.json({ error: `Booking status is ${booking.status}, not awaiting_payment` }, { status: 400 });
  }

  // Move to filling_template and dispatch
  store.updateBooking(bookingId, { status: "filling_template", paymentStatus: "paid" });

  const options = store.getOptions(bookingId);
  const selectedOption = booking.selectedOptionId
    ? options.find((o) => o.id === booking.selectedOptionId)
    : options[0];

  if (!selectedOption) {
    return NextResponse.json({ error: "No selected option" }, { status: 400 });
  }

  const result = await triggerDispatch(bookingId, selectedOption);

  // Save the agent message
  const agentMsg: ChatMessage = {
    id: uuid(),
    bookingId,
    role: "agent",
    content: result.content,
    timestamp: new Date().toISOString(),
    metadata: result.metadata ?? undefined,
  };
  store.addMessage(agentMsg);

  return NextResponse.json({ success: true, content: result.content });
}
