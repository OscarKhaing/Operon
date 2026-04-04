/**
 * Dummy PDF generation and email dispatch.
 * Replace with real PDF generation (e.g., puppeteer, pdf-lib) and
 * real email sending (e.g., nodemailer, SendGrid) in production.
 */

export interface PdfInput {
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
}

export interface PdfResult {
  pdfPath: string;
  sentTo: string;
  emailStatus: string;
  timestamp: string;
}

/**
 * Simulates:
 * 1. Generating a reservation PDF with the given fields
 * 2. Sending it as an email attachment to the hotel
 *
 * Returns dummy paths and confirmation.
 */
export function generateAndSendPdf(input: PdfInput): PdfResult {
  const timestamp = new Date().toISOString();
  const fileId = Date.now().toString(36);

  // ── Dummy PDF generation ──────────────────────────────────
  // In production: use pdf-lib or puppeteer to fill a real template
  const pdfPath = `/tmp/reservations/reservation-${fileId}.pdf`;

  console.log("=== DUMMY PDF GENERATED ===");
  console.log(`Path: ${pdfPath}`);
  console.log(`Guest: ${input.guestName} (${input.passport})`);
  console.log(`Hotel: ${input.hotelName} - ${input.roomType}`);
  console.log(`Dates: ${input.checkIn} to ${input.checkOut}`);
  console.log(`Guests: ${input.guestCount}`);
  console.log(`Total: $${input.totalPrice}`);
  console.log("===========================");

  // ── Dummy email send ──────────────────────────────────────
  // In production: use nodemailer/SendGrid to send the PDF
  console.log("=== DUMMY EMAIL SENT ===");
  console.log(`To: ${input.hotelEmail}`);
  console.log(`Subject: Reservation Request — ${input.guestName} — ${input.checkIn} to ${input.checkOut}`);
  console.log(`Attachment: ${pdfPath}`);
  console.log("========================");

  return {
    pdfPath,
    sentTo: input.hotelEmail,
    emailStatus: "sent (simulated)",
    timestamp,
  };
}
