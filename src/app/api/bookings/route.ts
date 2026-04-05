import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { BookingRequest } from "@/lib/types";
import { validateBookingPatch } from "@/lib/validation";
import { v4 as uuid } from "uuid";

// Transform backend booking to frontend BookingRequest
function transformBooking(backendBooking: any): BookingRequest {
  const statusMap: { [key: string]: BookingRequest['status'] } = {
    'intake': 'intake',
    'extracting': 'extracting',
    'options presented': 'options_presented',
    'sent to hotel': 'sent_to_hotel',
    'confirmed': 'confirmed',
    'cancelled': 'cancelled'
  };

  return {
    id: backendBooking._id || backendBooking.id,
    customer: {
      name: backendBooking.customerName || '',
      passport: '',
      email: '',
      phone: '',
      nationality: ''
    },
    travel: {
      checkIn: '',
      checkOut: '',
      guestCount: backendBooking.guests || 1,
      roomCount: 1,
      destination: backendBooking.destination || ''
    },
    preferences: {
      roomType: '',
      maxBudgetPerNight: backendBooking.budget || 0,
      currency: 'USD',
      specialRequests: backendBooking.notes || ''
    },
    status: statusMap[backendBooking.status] || 'intake',
    assignedTo: 'Unassigned',
    itemModel: backendBooking.itemModel,
    providerName: backendBooking.providerName,
    createdAt: backendBooking.createdAt || new Date().toISOString(),
    updatedAt: backendBooking.updatedAt || new Date().toISOString()
  };
}

export async function GET() {
  try {
    const response = await fetch('http://localhost:5001/api/bookings');
    if (!response.ok) {
      throw new Error('Failed to fetch bookings from backend');
    }
    const backendBookings = await response.json();
    const transformedBookings: BookingRequest[] = backendBookings.map(transformBooking);

    // Sync backend bookings into the in-memory store so the
    // chat/workflow system (which relies on store.getBooking()) can find them.
    for (const tb of transformedBookings) {
      if (!store.getBooking(tb.id)) {
        store.createBooking(tb);
      }
    }

    // Include any in-memory-only bookings (e.g. newly created via "New Booking"
    // button) that don't exist in the backend yet.
    const backendIds = new Set(transformedBookings.map((b) => b.id));
    const localOnly = store.getBookings().filter((b) => !backendIds.has(b.id));

    return NextResponse.json([...transformedBookings, ...localOnly]);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    // Fallback to mock data if backend is not available
    return NextResponse.json(store.getBookings());
  }
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
