/**
 * Dummy PDF generation.
 * Replace with real PDF generation (e.g., puppeteer, pdf-lib) in production.
 * Email dispatch has moved to email.ts (Resend).
 */

export interface PdfInput {
  bookingId?: string; // used to construct the PDF URL
  guestName: string;
  passport: string;
  nationality: string;
  email: string;
  phone: string;
  hotelName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  totalPrice: number;
  hotelEmail: string;
  specialRequests?: string;
}

export interface PdfResult {
  pdfPath: string;
  sentTo: string;
  emailStatus: string;
  timestamp: string;
}

/**
 * Generates a dummy PDF path for the reservation.
 * In production: use pdf-lib or puppeteer to create a real PDF.
 */
export function generateDummyPdf(input: PdfInput): PdfResult {
  const timestamp = new Date().toISOString();
  const fileId = Date.now().toString(36);

  const pdfPath = input.bookingId
    ? `/api/pdf/${input.bookingId}`
    : `/api/pdf/unknown-${fileId}`;

  console.log("=== DUMMY PDF GENERATED ===");
  console.log(`Path: ${pdfPath}`);
  console.log(`Guest: ${input.guestName} (${input.passport})`);
  console.log(`Hotel: ${input.hotelName} - ${input.roomType}`);
  console.log(`Dates: ${input.checkIn} to ${input.checkOut}`);
  console.log(`Guests: ${input.guestCount}`);
  console.log(`Total: $${input.totalPrice}`);
  console.log("===========================");

  return {
    pdfPath,
    sentTo: input.hotelEmail,
    emailStatus: "pending (pdf only — email handled by Resend)",
    timestamp,
  };
}
