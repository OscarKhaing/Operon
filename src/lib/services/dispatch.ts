/**
 * Simulated dispatch and confirmation service.
 * In production, replace with actual email/API integration.
 */
import { BookingTransaction } from "../types";
import { store } from "../store";
import { v4 as uuid } from "uuid";

export interface DispatchResult {
  success: boolean;
  transactionId: string;
  message: string;
}

/**
 * Simulate sending the reservation to the hotel.
 */
export function sendReservation(
  bookingId: string,
  optionId: string,
  documentUrl: string
): DispatchResult {
  const tx: BookingTransaction = {
    id: uuid(),
    bookingId,
    selectedOptionId: optionId,
    documentUrl,
    sentAt: new Date().toISOString(),
    confirmedAt: null,
    confirmationCode: null,
    status: "sent",
  };

  store.createTransaction(tx);
  store.updateBooking(bookingId, { status: "sent_to_hotel" });

  return {
    success: true,
    transactionId: tx.id,
    message: `Reservation sent to hotel. Awaiting confirmation.`,
  };
}

/**
 * Simulate receiving a hotel confirmation.
 */
export function simulateConfirmation(transactionId: string): {
  success: boolean;
  confirmationCode: string;
} {
  const code = `CONF-${Date.now().toString(36).toUpperCase()}`;

  const tx = store.transactions.find((t) => t.id === transactionId);
  if (!tx) {
    return { success: false, confirmationCode: "" };
  }

  store.updateTransaction(transactionId, {
    confirmedAt: new Date().toISOString(),
    confirmationCode: code,
    status: "confirmed",
  });

  store.updateBooking(tx.bookingId, { status: "confirmed" });

  return { success: true, confirmationCode: code };
}
