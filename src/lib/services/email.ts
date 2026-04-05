/**
 * Email dispatch service using Resend.
 * Sends reservation details to hotels via email.
 */
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || "reservations@resend.dev";
// Override: route all emails to a test inbox during development.
// Remove this or set to "" in production to send to actual hotel emails.
const TEST_RECIPIENT = process.env.RESEND_TEST_RECIPIENT || "akhaing@ucsd.edu";

export interface ReservationEmailInput {
  hotelEmail: string;
  hotelName: string;
  guestName: string;
  passport: string;
  nationality: string;
  guestEmail: string;
  guestPhone: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  totalPrice: number;
  currency: string;
  specialRequests?: string;
  pdfPath?: string; // reserved for future real PDF attachment
}

export interface EmailResult {
  success: boolean;
  emailId: string | null;
  sentTo: string;
  error: string | null;
  timestamp: string;
}

/**
 * Build the reservation email HTML body.
 */
function buildReservationHtml(input: ReservationEmailInput): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
  <div style="background: #0f172a; color: white; padding: 24px 32px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Reservation Request</h1>
    <p style="margin: 4px 0 0; opacity: 0.7; font-size: 14px;">Operon Booking System</p>
  </div>

  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 24px; font-size: 15px;">
      Dear <strong>${input.hotelName}</strong> Reservations Team,
    </p>
    <p style="margin: 0 0 24px; font-size: 15px;">
      We would like to request a reservation with the following details:
    </p>

    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280; width: 160px;">Guest Name</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.guestName}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Passport Number</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.passport}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Nationality</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.nationality}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Email</td>
        <td style="padding: 10px 0;">${input.guestEmail}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Phone</td>
        <td style="padding: 10px 0;">${input.guestPhone}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Room Type</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.roomType}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Check-in</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.checkIn}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Check-out</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.checkOut}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Number of Guests</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.guestCount}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Total Price</td>
        <td style="padding: 10px 0; font-weight: 700; color: #0369a1; font-size: 16px;">$${input.totalPrice} ${input.currency}</td>
      </tr>
      ${input.specialRequests ? `
      <tr>
        <td style="padding: 10px 0; color: #6b7280;">Special Requests</td>
        <td style="padding: 10px 0;">${input.specialRequests}</td>
      </tr>` : ""}
    </table>

    <p style="margin: 0 0 8px; font-size: 15px;">
      Please confirm this reservation at your earliest convenience.
    </p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      Thank you,<br/>
      Operon Booking Operations
    </p>
  </div>

  <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 16px;">
    This is an automated reservation request sent by Operon.
  </p>
</div>`.trim();
}

// ─── Cancellation email ─────────────────────────────────────────────────────

export interface CancellationEmailInput {
  hotelEmail: string;
  hotelName: string;
  guestName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  confirmationCode?: string | null;
  bookingId: string;
}

function buildCancellationHtml(input: CancellationEmailInput): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
  <div style="background: #c2410c; color: white; padding: 24px 32px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Reservation Cancellation</h1>
    <p style="margin: 4px 0 0; opacity: 0.7; font-size: 14px;">Operon Booking System</p>
  </div>

  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 24px; font-size: 15px;">
      Dear <strong>${input.hotelName}</strong> Reservations Team,
    </p>
    <p style="margin: 0 0 24px; font-size: 15px;">
      We regret to inform you that the following reservation has been cancelled:
    </p>

    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280; width: 160px;">Guest Name</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.guestName}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Room Type</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.roomType}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Check-in</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.checkIn}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Check-out</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.checkOut}</td>
      </tr>
      ${input.confirmationCode ? `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 0; color: #6b7280;">Confirmation Code</td>
        <td style="padding: 10px 0; font-weight: 600;">${input.confirmationCode}</td>
      </tr>` : ""}
    </table>

    <p style="margin: 0 0 8px; font-size: 15px;">
      Please release this reservation at your earliest convenience.
    </p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      Thank you,<br/>
      Operon Booking Operations
    </p>
  </div>

  <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 16px;">
    This is an automated cancellation notice sent by Operon.
  </p>
</div>`.trim();
}

export async function sendCancellationEmail(input: CancellationEmailInput): Promise<EmailResult> {
  const timestamp = new Date().toISOString();
  const subject = `Cancellation Notice — ${input.guestName} — ${input.checkIn} to ${input.checkOut}`;

  try {
    const recipient = TEST_RECIPIENT || input.hotelEmail;

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: recipient,
      subject: TEST_RECIPIENT
        ? `[TEST → ${input.hotelEmail}] ${subject}`
        : subject,
      html: buildCancellationHtml(input),
    });

    if (error) {
      console.error("Resend cancellation error:", error);
      return { success: false, emailId: null, sentTo: input.hotelEmail, error: error.message, timestamp };
    }

    console.log(`Cancellation email sent via Resend: ${data?.id} → ${recipient}`);
    return { success: true, emailId: data?.id ?? null, sentTo: input.hotelEmail, error: null, timestamp };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Resend cancellation send failed:", message);
    return { success: false, emailId: null, sentTo: input.hotelEmail, error: message, timestamp };
  }
}

// ─── Flight reservation email ──────────────────────────────────────────────

export interface FlightReservationEmailInput {
  airlineEmail: string;
  airlineName: string;
  guestName: string;
  passport: string;
  nationality: string;
  guestEmail: string;
  guestPhone: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  cabinClass: string;
  passengers: number;
  totalPrice: number;
  currency: string;
}

function buildFlightReservationHtml(input: FlightReservationEmailInput): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
  <div style="background: #1e3a5f; color: white; padding: 24px 32px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Flight Booking Request</h1>
    <p style="margin: 4px 0 0; opacity: 0.7; font-size: 14px;">Operon Booking System</p>
  </div>
  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 24px; font-size: 15px;">Dear <strong>${input.airlineName}</strong> Reservations,</p>
    <p style="margin: 0 0 24px; font-size: 15px;">We would like to book the following flight:</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280; width: 160px;">Passenger Name</td><td style="padding: 10px 0; font-weight: 600;">${input.guestName}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Passport</td><td style="padding: 10px 0; font-weight: 600;">${input.passport}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Nationality</td><td style="padding: 10px 0; font-weight: 600;">${input.nationality}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Email</td><td style="padding: 10px 0;">${input.guestEmail}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Phone</td><td style="padding: 10px 0;">${input.guestPhone}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Flight</td><td style="padding: 10px 0; font-weight: 600;">${input.flightNumber}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Route</td><td style="padding: 10px 0; font-weight: 600;">${input.origin} → ${input.destination}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Departure</td><td style="padding: 10px 0; font-weight: 600;">${input.departureDate}</td></tr>
      ${input.returnDate ? `<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Return</td><td style="padding: 10px 0; font-weight: 600;">${input.returnDate}</td></tr>` : ""}
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Cabin Class</td><td style="padding: 10px 0; font-weight: 600;">${input.cabinClass}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Passengers</td><td style="padding: 10px 0; font-weight: 600;">${input.passengers}</td></tr>
      <tr><td style="padding: 10px 0; color: #6b7280;">Total Price</td><td style="padding: 10px 0; font-weight: 700; color: #0369a1; font-size: 16px;">$${input.totalPrice} ${input.currency}</td></tr>
    </table>
    <p style="margin: 0 0 8px; font-size: 15px;">Please confirm this booking at your earliest convenience.</p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">Thank you,<br/>Operon Booking Operations</p>
  </div>
</div>`.trim();
}

export async function sendFlightReservationEmail(input: FlightReservationEmailInput): Promise<EmailResult> {
  const timestamp = new Date().toISOString();
  const subject = `Flight Booking — ${input.guestName} — ${input.flightNumber} ${input.origin} → ${input.destination}`;
  try {
    const recipient = TEST_RECIPIENT || input.airlineEmail;
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: recipient,
      subject: TEST_RECIPIENT ? `[TEST → ${input.airlineEmail}] ${subject}` : subject,
      html: buildFlightReservationHtml(input),
    });
    if (error) {
      console.error("Resend flight email error:", error);
      return { success: false, emailId: null, sentTo: input.airlineEmail, error: error.message, timestamp };
    }
    console.log(`Flight email sent via Resend: ${data?.id} → ${recipient}`);
    return { success: true, emailId: data?.id ?? null, sentTo: input.airlineEmail, error: null, timestamp };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, emailId: null, sentTo: input.airlineEmail, error: message, timestamp };
  }
}

// ─── Restaurant reservation email ─────────────────────────────────────────

export interface RestaurantReservationEmailInput {
  restaurantEmail: string;
  restaurantName: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  date: string;
  time: string;
  partySize: number;
  cuisine: string;
  specialRequests?: string;
}

function buildRestaurantReservationHtml(input: RestaurantReservationEmailInput): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
  <div style="background: #4a1942; color: white; padding: 24px 32px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Table Reservation Request</h1>
    <p style="margin: 4px 0 0; opacity: 0.7; font-size: 14px;">Operon Booking System</p>
  </div>
  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 24px; font-size: 15px;">Dear <strong>${input.restaurantName}</strong>,</p>
    <p style="margin: 0 0 24px; font-size: 15px;">We would like to request a table reservation:</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280; width: 160px;">Guest Name</td><td style="padding: 10px 0; font-weight: 600;">${input.guestName}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Email</td><td style="padding: 10px 0;">${input.guestEmail}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Phone</td><td style="padding: 10px 0;">${input.guestPhone}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Date</td><td style="padding: 10px 0; font-weight: 600;">${input.date}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Time</td><td style="padding: 10px 0; font-weight: 600;">${input.time}</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Party Size</td><td style="padding: 10px 0; font-weight: 600;">${input.partySize} guests</td></tr>
      <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Cuisine</td><td style="padding: 10px 0; font-weight: 600;">${input.cuisine}</td></tr>
      ${input.specialRequests ? `<tr><td style="padding: 10px 0; color: #6b7280;">Special Requests</td><td style="padding: 10px 0;">${input.specialRequests}</td></tr>` : ""}
    </table>
    <p style="margin: 0 0 8px; font-size: 15px;">Please confirm this reservation at your earliest convenience.</p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">Thank you,<br/>Operon Booking Operations</p>
  </div>
</div>`.trim();
}

export async function sendRestaurantReservationEmail(input: RestaurantReservationEmailInput): Promise<EmailResult> {
  const timestamp = new Date().toISOString();
  const subject = `Table Reservation — ${input.guestName} — ${input.date} at ${input.time}`;
  try {
    const recipient = TEST_RECIPIENT || input.restaurantEmail;
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: recipient,
      subject: TEST_RECIPIENT ? `[TEST → ${input.restaurantEmail}] ${subject}` : subject,
      html: buildRestaurantReservationHtml(input),
    });
    if (error) {
      console.error("Resend restaurant email error:", error);
      return { success: false, emailId: null, sentTo: input.restaurantEmail, error: error.message, timestamp };
    }
    console.log(`Restaurant email sent via Resend: ${data?.id} → ${recipient}`);
    return { success: true, emailId: data?.id ?? null, sentTo: input.restaurantEmail, error: null, timestamp };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, emailId: null, sentTo: input.restaurantEmail, error: message, timestamp };
  }
}

// ─── Hotel reservation email ──────────────────────────────────────────────

/**
 * Send the reservation email to the hotel via Resend.
 */
export async function sendReservationEmail(input: ReservationEmailInput): Promise<EmailResult> {
  const timestamp = new Date().toISOString();
  const subject = `Reservation Request — ${input.guestName} — ${input.checkIn} to ${input.checkOut}`;

  try {
    const recipient = TEST_RECIPIENT || input.hotelEmail;

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: recipient,
      subject: TEST_RECIPIENT
        ? `[TEST → ${input.hotelEmail}] ${subject}`
        : subject,
      html: buildReservationHtml(input),
    });

    if (error) {
      console.error("Resend error:", error);
      return {
        success: false,
        emailId: null,
        sentTo: input.hotelEmail,
        error: error.message,
        timestamp,
      };
    }

    console.log(`Email sent via Resend: ${data?.id} → ${recipient}${TEST_RECIPIENT ? ` (intended for ${input.hotelEmail})` : ""}`);
    return {
      success: true,
      emailId: data?.id ?? null,
      sentTo: input.hotelEmail,
      error: null,
      timestamp,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Resend send failed:", message);
    return {
      success: false,
      emailId: null,
      sentTo: input.hotelEmail,
      error: message,
      timestamp,
    };
  }
}
