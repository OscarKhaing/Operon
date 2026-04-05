import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { findOptions } from "@/lib/services/matching";
import { validateMatchingPost } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const v = validateMatchingPost(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const booking = store.getBooking(v.data.bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Clear previous options before re-matching
  store.clearOptions(v.data.bookingId);

  const { options } = await findOptions(booking);
  store.addOptions(options);

  if (options.length > 0) {
    store.updateBooking(v.data.bookingId, { status: "options_presented" });
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
