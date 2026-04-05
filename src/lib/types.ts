// ===== Core Data Models =====

export type BookingStatus =
  | "intake"
  | "extracting"
  | "matching"
  | "options_presented"
  | "selected"
  | "collecting_info"
  | "filling_template"
  | "sent_to_hotel"
  | "confirmed"
  | "cancelled";

export interface CustomerInfo {
  name: string;
  passport: string;
  email: string;
  phone: string;
  nationality: string;
}

export interface TravelDetails {
  checkIn: string; // ISO date
  checkOut: string;
  guestCount: number;
  roomCount: number;
  destination: string;
}

export interface Preferences {
  roomType: string; // e.g. "standard", "deluxe", "suite"
  maxBudgetPerNight: number;
  currency: string;
  specialRequests: string;
}

export interface BookingRequest {
  id: string;
  customer: CustomerInfo;
  travel: TravelDetails;
  preferences: Preferences;
  status: BookingStatus;
  assignedTo: string; // operator name
  pdfUrl?: string; // URL to generated reservation PDF
  rejectedOptionIds?: string[]; // options rejected by hotels (no availability)
  createdAt: string;
  updatedAt: string;
}

// ===== Hotel =====

export interface RoomType {
  id: string;
  name: string; // "Standard", "Deluxe", "Suite"
  basePrice: number;
  currency: string;
  maxGuests: number;
  amenities: string[];
}

export interface HotelRecord {
  id: string;
  name: string;
  location: string;
  city: string;
  stars: number;
  contactEmail: string;
  contactPhone: string;
  roomTypes: RoomType[];
  templateId: string; // which contract template to use
  tags: string[]; // e.g. "beachfront", "business", "family"
}

// ===== Template =====

export interface TemplateField {
  key: string;
  label: string;
  source: "customer" | "travel" | "preferences" | "hotel" | "computed";
  required: boolean;
}

export interface TemplateRecord {
  id: string;
  name: string;
  hotelId: string;
  fields: TemplateField[];
}

// ===== Booking Option =====

export interface BookingOption {
  id: string;
  bookingId: string;
  hotelId: string;
  hotelName: string;
  roomType: RoomType;
  totalPrice: number;
  nightCount: number;
  score: number; // 0-100 ranking score
  explanation: string;
}

// ===== Booking Transaction =====

export interface BookingTransaction {
  id: string;
  bookingId: string;
  selectedOptionId: string;
  documentUrl: string | null;
  sentAt: string | null;
  confirmedAt: string | null;
  confirmationCode: string | null;
  status: "pending" | "sent" | "confirmed" | "rejected";
  hotelResponseType?: "confirmed" | "more_info_needed" | "no_availability";
  hotelMessage?: string;
  retryCount?: number;
}

// ===== Chat =====

export type MessageRole = "customer" | "agent" | "system";

// Structured metadata attached to chat messages for rich UI rendering.
// `content` always holds a plain-text version (for WhatsApp/WeChat fallback).
// `metadata` holds structured data for web UI rendering (clickable cards, etc.).
export type MessageMetadata =
  | { type: "hotel_options"; options: HotelOptionCard[] }
  | { type: "option_selected"; optionIndex: number; optionId: string }
  | { type: "hotel_response"; responseType: "confirmed" | "more_info_needed" | "no_availability"; message: string }
  | null;

export interface HotelOptionCard {
  optionId: string;
  hotelName: string;
  roomType: string;
  pricePerNight: number;
  totalPrice: number;
  nights: number;
  stars: number;
  amenities: string[];
  score: number;
  explanation: string;
}

export interface ChatMessage {
  id: string;
  bookingId: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  metadata?: MessageMetadata;
}

// ===== Extraction Result =====

export interface ExtractionResult {
  customer: Partial<CustomerInfo>;
  travel: Partial<TravelDetails>;
  preferences: Partial<Preferences>;
  missingFields: string[];
  confidence: number;
}

// ===== Dashboard Stats =====

export interface DashboardStats {
  totalBookings: number;
  byStatus: Record<BookingStatus, number>;
  revenueToday: number;
  confirmationRate: number;
}
