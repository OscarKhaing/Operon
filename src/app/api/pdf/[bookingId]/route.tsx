import { renderToBuffer } from "@react-pdf/renderer";
import { store } from "@/lib/store";
import { ReservationDocument } from "@/lib/pdf/reservation-template";
import { PdfInput } from "@/lib/services/pdf-dummy";
import { fetchHotelById } from "@/lib/services/hotel-api";
import React from "react";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;

  const booking = store.getBooking(bookingId);
  if (!booking) {
    return new Response(JSON.stringify({ error: "Booking not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const options = store.getOptions(booking.id);
  const option = options[0];
  if (!option) {
    return new Response(JSON.stringify({ error: "No hotel option selected" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (option.category !== "hotel") {
    return new Response(JSON.stringify({ error: "PDF generation only supported for hotel bookings" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hotel = await fetchHotelById(option.hotelId);

  const pdfInput: PdfInput = {
    bookingId: booking.id,
    guestName: booking.customer.name,
    passport: booking.customer.passport,
    nationality: booking.customer.nationality,
    email: booking.customer.email,
    phone: booking.customer.phone,
    hotelName: option.hotelName,
    roomType: option.roomType.name,
    checkIn: booking.travel.checkIn,
    checkOut: booking.travel.checkOut,
    guestCount: booking.travel.guestCount,
    totalPrice: option.totalPrice,
    hotelEmail: hotel?.contactEmail || "hotel@example.com",
    specialRequests: booking.preferences.specialRequests,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    React.createElement(ReservationDocument, { input: pdfInput }) as any
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="reservation-${booking.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
