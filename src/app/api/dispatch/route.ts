import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { sendReservation, simulateConfirmation } from "@/lib/services/dispatch";

export async function POST(req: Request) {
  const { bookingId, optionId } = await req.json();

  const booking = store.getBooking(bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const result = sendReservation(bookingId, optionId, `/docs/reservation-${bookingId}.pdf`);
  return NextResponse.json(result);
}

/** Simulate hotel confirmation */
export async function PATCH(req: Request) {
  const { transactionId } = await req.json();

  const result = simulateConfirmation(transactionId);
  if (!result.success) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Get updated transaction to find booking ID for notification
  const tx = store.transactions.find((t) => t.id === transactionId);

  return NextResponse.json({
    ...result,
    bookingId: tx?.bookingId,
    message: `Booking confirmed! Code: ${result.confirmationCode}`,
  });
}
