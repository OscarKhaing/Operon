import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { selectTemplate, fillTemplate } from "@/lib/services/template";
import { validateTemplatesPost } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(store.getTemplates());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const v = validateTemplatesPost(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const booking = store.getBooking(v.data.bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const options = store.getOptions(v.data.bookingId);
  const option = options.find((o) => o.id === v.data.optionId);
  if (!option) {
    return NextResponse.json({ error: "Option not found" }, { status: 404 });
  }

  const template = selectTemplate(option.hotelId);
  if (!template) {
    return NextResponse.json({ error: "No template found for hotel" }, { status: 404 });
  }

  const filled = fillTemplate(template, booking, option);

  store.updateBooking(v.data.bookingId, { status: "filling_template" });

  return NextResponse.json(filled);
}
