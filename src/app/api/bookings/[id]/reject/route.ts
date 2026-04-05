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
  const reason = body.reason || "Rejected by operator";

  const booking = store.getBooking(id);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "sent_to_hotel") {
    return NextResponse.json(
      { error: `Cannot reject booking in status "${booking.status}"` },
      { status: 409 },
    );
  }

  // Update transaction
  const tx = store.getLatestTransaction(id);
  if (tx) {
    store.updateTransaction(tx.id, {
      status: "rejected",
      hotelResponseType: "no_availability",
      hotelMessage: reason,
    });

    // Track rejected option
    const rejected = booking.rejectedOptionIds ?? [];
    if (!rejected.includes(tx.selectedOptionId)) {
      rejected.push(tx.selectedOptionId);
    }
    store.updateBooking(id, {
      status: "options_presented",
      rejectedOptionIds: rejected,
    });
  } else {
    store.updateBooking(id, { status: "options_presented" });
  }

  // System message
  const msg: ChatMessage = {
    id: uuid(),
    bookingId: id,
    role: "system",
    content: `Operator marked booking as rejected. Reason: ${reason}`,
    timestamp: new Date().toISOString(),
    metadata: { type: "hotel_response", responseType: "no_availability", message: reason },
  };
  store.addMessage(msg);

  return NextResponse.json({ success: true, reason });
}
