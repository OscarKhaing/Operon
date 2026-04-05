import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { sendReservation, simulateConfirmation } from "@/lib/services/dispatch";
import { validateDispatchPost, validateDispatchPatch } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const v = validateDispatchPost(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const booking = store.getBooking(v.data.bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const result = sendReservation(v.data.bookingId, v.data.optionId, `/docs/reservation-${v.data.bookingId}.pdf`);
  return NextResponse.json(result);
}

/** Simulate hotel confirmation */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const v = validateDispatchPatch(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const result = simulateConfirmation(v.data.transactionId);
  if (!result.success) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Get updated transaction to find booking ID for notification
  const tx = store.transactions.find((t) => t.id === v.data.transactionId);

  return NextResponse.json({
    ...result,
    bookingId: tx?.bookingId,
    message: `Booking confirmed! Code: ${result.confirmationCode}`,
  });
}
