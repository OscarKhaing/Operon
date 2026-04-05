import { BookingCategory, BookingStatus } from "./types";

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function statusLabel(status: BookingStatus, category?: BookingCategory): string {
  const labels: Record<BookingStatus, string> = {
    intake: "Intake",
    extracting: "Extracting Info",
    matching: category === "flight" ? "Finding Flights" : category === "restaurant" ? "Finding Restaurants" : "Finding Hotels",
    options_presented: "Options Sent",
    selected: "Option Selected",
    collecting_info: "Collecting Info",
    awaiting_payment: "Awaiting Payment",
    filling_template: "Processing",
    sent_to_hotel: category === "flight" ? "Sent to Airline" : category === "restaurant" ? "Sent to Restaurant" : "Sent to Hotel",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const d1 = new Date(checkIn);
  const d2 = new Date(checkOut);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}
