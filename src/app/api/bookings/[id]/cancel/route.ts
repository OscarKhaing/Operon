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
  const reason = body.reason || "Cancelled by operator";

  const booking = store.getBooking(id);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "Booking is already cancelled" }, { status: 409 });
  }
  if (booking.status === "confirmed" && !body.force) {
    return NextResponse.json(
      { error: "Booking is confirmed. Pass { force: true } to cancel a confirmed booking." },
      { status: 409 },
    );
  }

  // Cancel any active transaction
  const tx = store.getLatestTransaction(id);
  if (tx && tx.status === "sent") {
    store.updateTransaction(tx.id, { status: "rejected" });
  }

  store.updateBooking(id, { status: "cancelled" });

  const msg: ChatMessage = {
    id: uuid(),
    bookingId: id,
    role: "system",
    content: `Booking cancelled. Reason: ${reason}`,
    timestamp: new Date().toISOString(),
  };
  store.addMessage(msg);

  return NextResponse.json({ success: true, reason });
}
