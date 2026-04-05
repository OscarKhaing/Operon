import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { BookingRequest } from "@/lib/types";
import { validateBookingPatch } from "@/lib/validation";
import { v4 as uuid } from "uuid";

export async function GET() {
  return NextResponse.json(store.getBookings());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }
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
      guestCount: body.travel?.guestCount || 0,
      roomCount: body.travel?.roomCount || 1,
      destination: body.travel?.destination || "",
    },
    preferences: {
      roomType: body.preferences?.roomType || "",
      maxBudgetPerNight: body.preferences?.maxBudgetPerNight || 0,
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
  const body = await req.json().catch(() => null);
  const v = validateBookingPatch(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const { id, customer, travel, preferences, ...rest } = v.data;

  const booking = store.getBooking(id);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Deep-merge nested objects so partial updates don't destroy sibling fields
  const merged: Partial<BookingRequest> = { ...rest };
  if (customer) merged.customer = { ...booking.customer, ...customer } as BookingRequest["customer"];
  if (travel) merged.travel = { ...booking.travel, ...travel } as BookingRequest["travel"];
  if (preferences) merged.preferences = { ...booking.preferences, ...preferences } as BookingRequest["preferences"];

  const updated = store.updateBooking(id, merged);
  return NextResponse.json(updated);
}
