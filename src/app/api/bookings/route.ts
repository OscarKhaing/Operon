import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { BookingRequest } from "@/lib/types";
import { v4 as uuid } from "uuid";

export async function GET() {
  return NextResponse.json(store.getBookings());
}

export async function POST(req: Request) {
  const body = await req.json();
  const now = new Date().toISOString();

  const booking: BookingRequest = {
    id: uuid(),
    customer: {
      name: body.customer?.name || "",
      passport: body.customer?.passport || "",
      email: body.customer?.email || "",
      phone: body.customer?.phone || "",
      nationality: body.customer?.nationality || "",
    },
    travel: {
      checkIn: body.travel?.checkIn || "",
      checkOut: body.travel?.checkOut || "",
      guestCount: body.travel?.guestCount || 1,
      roomCount: body.travel?.roomCount || 1,
      destination: body.travel?.destination || "",
    },
    preferences: {
      roomType: body.preferences?.roomType || "standard",
      maxBudgetPerNight: body.preferences?.maxBudgetPerNight || 200,
      currency: body.preferences?.currency || "USD",
      specialRequests: body.preferences?.specialRequests || "",
    },
    status: "intake",
    assignedTo: body.assignedTo || "Unassigned",
    createdAt: now,
    updatedAt: now,
  };

  store.createBooking(booking);
  return NextResponse.json(booking, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, ...updates } = body;
  const updated = store.updateBooking(id, updates);
  if (!updated) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
