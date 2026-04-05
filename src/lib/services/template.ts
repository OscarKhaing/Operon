/**
 * Template selection and auto-fill service.
 * Selects the right contract template and fills it with booking data.
 */
import { BookingRequest, BookingOption, HotelBookingOption, TemplateRecord, TemplateField } from "../types";
import { store } from "../store";

export interface FilledTemplate {
  templateId: string;
  templateName: string;
  fields: { key: string; label: string; value: string; required: boolean }[];
  missingRequired: string[];
  complete: boolean;
}

function resolveFieldValue(
  field: TemplateField,
  booking: BookingRequest,
  option: HotelBookingOption
): string {
  switch (field.key) {
    case "guestName":
      return booking.customer.name || "";
    case "passport":
      return booking.customer.passport || "";
    case "nationality":
      return booking.customer.nationality || "";
    case "email":
      return booking.customer.email || "";
    case "phone":
      return booking.customer.phone || "";
    case "checkIn":
      return booking.travel.checkIn || "";
    case "checkOut":
      return booking.travel.checkOut || "";
    case "roomType":
      return option.roomType.name || "";
    case "guestCount":
      return String(booking.travel.guestCount || "");
    case "roomCount":
      return String(booking.travel.roomCount || "");
    case "totalPrice":
      return `$${option.totalPrice} USD`;
    case "specialRequests":
      return booking.preferences.specialRequests || "None";
    default:
      return "";
  }
}

export function selectTemplate(hotelId: string): TemplateRecord | null {
  return store.getTemplateForHotel(hotelId) || null;
}

export function fillTemplate(
  template: TemplateRecord,
  booking: BookingRequest,
  option: HotelBookingOption
): FilledTemplate {
  const fields = template.fields.map((field) => ({
    key: field.key,
    label: field.label,
    value: resolveFieldValue(field, booking, option),
    required: field.required,
  }));

  const missingRequired = fields
    .filter((f) => f.required && !f.value)
    .map((f) => f.label);

  return {
    templateId: template.id,
    templateName: template.name,
    fields,
    missingRequired,
    complete: missingRequired.length === 0,
  };
}
