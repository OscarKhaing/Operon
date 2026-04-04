import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { selectTemplate, fillTemplate } from "@/lib/services/template";

export async function GET() {
  return NextResponse.json(store.getTemplates());
}

export async function POST(req: Request) {
  const { bookingId, optionId } = await req.json();

  const booking = store.getBooking(bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const options = store.getOptions(bookingId);
  const option = options.find((o) => o.id === optionId);
  if (!option) {
    return NextResponse.json({ error: "Option not found" }, { status: 404 });
  }

  const template = selectTemplate(option.hotelId);
  if (!template) {
    return NextResponse.json({ error: "No template found for hotel" }, { status: 404 });
  }

  const filled = fillTemplate(template, booking, option);

  store.updateBooking(bookingId, { status: "filling_template" });

  return NextResponse.json(filled);
}
