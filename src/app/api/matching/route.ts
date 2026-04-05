import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { findOptions } from "@/lib/services/matching";

export async function POST(req: Request) {
  const { bookingId } = await req.json();

  const booking = store.getBooking(bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Clear previous options before re-matching
  store.clearOptions(bookingId);

  const options = findOptions(booking);
  store.addOptions(options);

  if (options.length > 0) {
    store.updateBooking(bookingId, { status: "options_presented" });
  }

  return NextResponse.json({ options });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }
  return NextResponse.json(store.getOptions(bookingId));
}
