import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ChatMessage } from "@/lib/types";
import { v4 as uuid } from "uuid";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const booking = store.getBooking(id);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "sent_to_hotel") {
    return NextResponse.json(
      { error: `Cannot confirm booking in status "${booking.status}"` },
      { status: 409 },
    );
  }

  const code = body.confirmationCode || `CONF-${Date.now().toString(36).toUpperCase()}`;

  // Update transaction
  const tx = store.getLatestTransaction(id);
  if (tx) {
    store.updateTransaction(tx.id, {
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
      confirmationCode: code,
      hotelResponseType: "confirmed",
      hotelMessage: "Manually confirmed by operator",
    });
  }

  // Update booking
  store.updateBooking(id, { status: "confirmed" });

  // System message
  const msg: ChatMessage = {
    id: uuid(),
    bookingId: id,
    role: "system",
    content: `Operator manually confirmed booking. Confirmation code: ${code}`,
    timestamp: new Date().toISOString(),
    metadata: { type: "hotel_response", responseType: "confirmed", message: `Confirmation code: ${code}` },
  };
  store.addMessage(msg);

  return NextResponse.json({ success: true, confirmationCode: code });
}
