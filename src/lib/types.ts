// ===== Core Data Models =====

export type BookingCategory = "hotel" | "flight" | "restaurant";

export type BookingStatus =
  | "intake"
  | "extracting"
  | "matching"
  | "options_presented"
  | "selected"
  | "collecting_info"
  | "awaiting_payment"
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

// ===== Flight-specific details =====

export interface FlightDetails {
  origin: string;
  destination: string;
  departureDate: string; // ISO date
  returnDate: string;    // ISO date, empty for one-way
  passengers: number;
  cabinClass: string;    // Economy, Premium Economy, Business, First
  maxBudget: number;
}

// ===== Restaurant-specific details =====

export interface RestaurantDetails {
  location: string;
  date: string;     // ISO date
  time: string;     // e.g. "19:00"
  partySize: number;
  cuisine: string;
  priceRange: string; // e.g. "30-50"
}

export interface BookingRequest {
  id: string;
  category?: BookingCategory;
  categories?: BookingCategory[];       // multi-category: all categories to book
  activeCategory?: BookingCategory;     // which category is currently being processed
  completedCategories?: BookingCategory[]; // categories that have been confirmed
  confirmedBookings?: ConfirmedBookingSummary[]; // summaries of each confirmed category
  conciseMode?: boolean;                // when true, chatbot asks for all info at once
  customer: CustomerInfo;
  travel: TravelDetails;
  preferences: Preferences;
  flightDetails?: FlightDetails;
  restaurantDetails?: RestaurantDetails;
  status: BookingStatus;
  assignedTo: string; // operator name
  channel?: "web" | "instagram";
  instagramSenderId?: string;
  selectedOptionId?: string;
  stripeSessionId?: string;
  paymentStatus?: "unpaid" | "paid";
  pdfUrl?: string; // URL to generated reservation PDF
  rejectedOptionIds?: string[]; // options rejected by hotels (no availability)
  cancelRequested?: boolean; // true when customer expressed cancel intent, awaiting confirmation
  itemModel?: string; // "Flight", "Hotel", "Restaurant"
  providerName?: string; // airline/hotel name
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

// ===== Flight =====

export interface FlightRecord {
  id: string;
  airline: string;       // providerName
  flightNumber: string;
  origin: string;        // e.g. "San Diego (SAN)"
  destination: string;   // e.g. "Tokyo (NRT)"
  departureDate: string; // ISO date
  returnDate: string;    // ISO date
  cabinClass: string;    // Economy, Premium Economy, Business, First
  price: number;         // discountedPrice
  basePrice: number;
  inventory: number;
}

// ===== Restaurant =====

export interface RestaurantRecord {
  id: string;
  name: string;          // providerName
  location: string;
  cuisine: string;
  priceRange: string;    // "10-20", "20-30", "30-50", "50-100", "100+"
  rating: number;        // 0-5
  amenities: string[];
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

// ===== Confirmed Booking Summary =====

export interface ConfirmedBookingSummary {
  category: BookingCategory;
  providerName: string;  // hotel name, airline + flight#, restaurant name
  details: string;       // "Aug 4-10, London" or "LAX → LHR, Economy" or "Italian, 7pm"
  totalPrice: number;
  confirmationCode: string;
}

// ===== Booking Option (discriminated union) =====

interface BaseBookingOption {
  id: string;
  bookingId: string;
  category: BookingCategory;
  totalPrice: number;
  score: number; // 0-100 ranking score
  explanation: string;
}

export interface HotelBookingOption extends BaseBookingOption {
  category: "hotel";
  hotelId: string;
  hotelName: string;
  roomType: RoomType;
  nightCount: number;
}

export interface FlightBookingOption extends BaseBookingOption {
  category: "flight";
  flightId: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabinClass: string;
}

export interface RestaurantBookingOption extends BaseBookingOption {
  category: "restaurant";
  restaurantId: string;
  restaurantName: string;
  cuisine: string;
  location: string;
  priceRange: string;
  rating: number;
  amenities: string[];
}

export type BookingOption = HotelBookingOption | FlightBookingOption | RestaurantBookingOption;

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
  | { type: "flight_options"; options: FlightOptionCard[] }
  | { type: "restaurant_options"; options: RestaurantOptionCard[] }
  | { type: "option_selected"; optionIndex: number; optionId: string }
  | { type: "hotel_response"; responseType: "confirmed" | "more_info_needed" | "no_availability"; message: string }
  | { type: "provider_response"; responseType: "confirmed" | "more_info_needed" | "no_availability"; message: string }
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

export interface FlightOptionCard {
  optionId: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabinClass: string;
  price: number;
  score: number;
  explanation: string;
}

export interface RestaurantOptionCard {
  optionId: string;
  restaurantName: string;
  cuisine: string;
  location: string;
  priceRange: string;
  rating: number;
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
