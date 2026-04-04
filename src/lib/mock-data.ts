import {
  BookingRequest,
  HotelRecord,
  TemplateRecord,
  ChatMessage,
  BookingOption,
  BookingTransaction,
} from "./types";

// ===== Hotels =====

export const MOCK_HOTELS: HotelRecord[] = [
  {
    id: "h1",
    name: "Grand Marina Bay Hotel",
    location: "Marina Bay, Singapore",
    city: "Singapore",
    stars: 5,
    contactEmail: "reservations@grandmarinabay.com",
    contactPhone: "+65-6888-1234",
    roomTypes: [
      { id: "h1-std", name: "Standard", basePrice: 180, currency: "USD", maxGuests: 2, amenities: ["WiFi", "Breakfast", "Pool"] },
      { id: "h1-dlx", name: "Deluxe", basePrice: 280, currency: "USD", maxGuests: 3, amenities: ["WiFi", "Breakfast", "Pool", "Lounge", "City View"] },
      { id: "h1-ste", name: "Suite", basePrice: 450, currency: "USD", maxGuests: 4, amenities: ["WiFi", "Breakfast", "Pool", "Lounge", "Bay View", "Butler Service"] },
    ],
    templateId: "t1",
    tags: ["luxury", "business", "waterfront"],
  },
  {
    id: "h2",
    name: "Sakura Garden Inn",
    location: "Shinjuku, Tokyo",
    city: "Tokyo",
    stars: 4,
    contactEmail: "book@sakuragarden.jp",
    contactPhone: "+81-3-5555-0102",
    roomTypes: [
      { id: "h2-std", name: "Standard", basePrice: 120, currency: "USD", maxGuests: 2, amenities: ["WiFi", "Green Tea Set"] },
      { id: "h2-dlx", name: "Deluxe", basePrice: 200, currency: "USD", maxGuests: 2, amenities: ["WiFi", "Green Tea Set", "Onsen Access", "Garden View"] },
      { id: "h2-ste", name: "Suite", basePrice: 350, currency: "USD", maxGuests: 3, amenities: ["WiFi", "Breakfast", "Onsen Access", "Garden View", "Tatami Room"] },
    ],
    templateId: "t2",
    tags: ["traditional", "garden", "family"],
  },
  {
    id: "h3",
    name: "The Bund Palace",
    location: "The Bund, Shanghai",
    city: "Shanghai",
    stars: 5,
    contactEmail: "reservations@bundpalace.cn",
    contactPhone: "+86-21-6333-8888",
    roomTypes: [
      { id: "h3-std", name: "Standard", basePrice: 150, currency: "USD", maxGuests: 2, amenities: ["WiFi", "Breakfast"] },
      { id: "h3-dlx", name: "Deluxe River View", basePrice: 250, currency: "USD", maxGuests: 2, amenities: ["WiFi", "Breakfast", "River View", "Minibar"] },
      { id: "h3-ste", name: "Presidential Suite", basePrice: 600, currency: "USD", maxGuests: 4, amenities: ["WiFi", "Breakfast", "River View", "Butler", "Spa"] },
    ],
    templateId: "t3",
    tags: ["luxury", "waterfront", "business"],
  },
  {
    id: "h4",
    name: "Orchid Beach Resort",
    location: "Patong, Phuket",
    city: "Phuket",
    stars: 4,
    contactEmail: "stay@orchidbeach.th",
    contactPhone: "+66-76-555-789",
    roomTypes: [
      { id: "h4-std", name: "Garden Room", basePrice: 85, currency: "USD", maxGuests: 2, amenities: ["WiFi", "Pool", "Garden View"] },
      { id: "h4-dlx", name: "Ocean View", basePrice: 150, currency: "USD", maxGuests: 3, amenities: ["WiFi", "Pool", "Ocean View", "Balcony"] },
      { id: "h4-ste", name: "Beachfront Villa", basePrice: 300, currency: "USD", maxGuests: 4, amenities: ["WiFi", "Private Pool", "Beach Access", "Butler"] },
    ],
    templateId: "t4",
    tags: ["beach", "resort", "family", "honeymoon"],
  },
  {
    id: "h5",
    name: "Seoul Tower Hotel",
    location: "Myeongdong, Seoul",
    city: "Seoul",
    stars: 4,
    contactEmail: "book@seoultower.kr",
    contactPhone: "+82-2-777-5500",
    roomTypes: [
      { id: "h5-std", name: "Standard", basePrice: 100, currency: "USD", maxGuests: 2, amenities: ["WiFi", "Breakfast"] },
      { id: "h5-dlx", name: "Deluxe", basePrice: 170, currency: "USD", maxGuests: 2, amenities: ["WiFi", "Breakfast", "City View", "Minibar"] },
      { id: "h5-ste", name: "Executive Suite", basePrice: 280, currency: "USD", maxGuests: 3, amenities: ["WiFi", "Breakfast", "City View", "Lounge", "Gym"] },
    ],
    templateId: "t5",
    tags: ["city", "shopping", "business"],
  },
  {
    id: "h6",
    name: "Lotus Riverside Hotel",
    location: "District 1, Ho Chi Minh City",
    city: "Ho Chi Minh City",
    stars: 3,
    contactEmail: "info@lotusriverside.vn",
    contactPhone: "+84-28-3822-1234",
    roomTypes: [
      { id: "h6-std", name: "Standard", basePrice: 55, currency: "USD", maxGuests: 2, amenities: ["WiFi", "Breakfast"] },
      { id: "h6-dlx", name: "Superior", basePrice: 85, currency: "USD", maxGuests: 2, amenities: ["WiFi", "Breakfast", "River View", "Minibar"] },
      { id: "h6-ste", name: "Suite", basePrice: 140, currency: "USD", maxGuests: 3, amenities: ["WiFi", "Breakfast", "River View", "Lounge", "Spa Credit"] },
    ],
    templateId: "t6",
    tags: ["budget", "riverside", "city"],
  },
];

// ===== Templates =====

export const MOCK_TEMPLATES: TemplateRecord[] = [
  {
    id: "t1",
    name: "Grand Marina Bay - Standard Contract",
    hotelId: "h1",
    fields: [
      { key: "guestName", label: "Guest Full Name", source: "customer", required: true },
      { key: "passport", label: "Passport Number", source: "customer", required: true },
      { key: "checkIn", label: "Check-in Date", source: "travel", required: true },
      { key: "checkOut", label: "Check-out Date", source: "travel", required: true },
      { key: "roomType", label: "Room Type", source: "preferences", required: true },
      { key: "guestCount", label: "Number of Guests", source: "travel", required: true },
      { key: "totalPrice", label: "Total Price", source: "computed", required: true },
      { key: "specialRequests", label: "Special Requests", source: "preferences", required: false },
    ],
  },
  {
    id: "t2", name: "Sakura Garden Inn - Reservation Form", hotelId: "h2",
    fields: [
      { key: "guestName", label: "Guest Name", source: "customer", required: true },
      { key: "passport", label: "Passport", source: "customer", required: true },
      { key: "checkIn", label: "Arrival", source: "travel", required: true },
      { key: "checkOut", label: "Departure", source: "travel", required: true },
      { key: "roomType", label: "Room", source: "preferences", required: true },
      { key: "guestCount", label: "Guests", source: "travel", required: true },
      { key: "totalPrice", label: "Total (USD)", source: "computed", required: true },
    ],
  },
  {
    id: "t3", name: "Bund Palace - Booking Contract", hotelId: "h3",
    fields: [
      { key: "guestName", label: "Guest Name", source: "customer", required: true },
      { key: "passport", label: "Passport No.", source: "customer", required: true },
      { key: "nationality", label: "Nationality", source: "customer", required: true },
      { key: "checkIn", label: "Check-in", source: "travel", required: true },
      { key: "checkOut", label: "Check-out", source: "travel", required: true },
      { key: "roomType", label: "Room Category", source: "preferences", required: true },
      { key: "guestCount", label: "No. of Guests", source: "travel", required: true },
      { key: "totalPrice", label: "Total Amount", source: "computed", required: true },
    ],
  },
  { id: "t4", name: "Orchid Beach - Reservation", hotelId: "h4", fields: [
    { key: "guestName", label: "Guest Name", source: "customer", required: true },
    { key: "passport", label: "Passport", source: "customer", required: true },
    { key: "checkIn", label: "Check-in", source: "travel", required: true },
    { key: "checkOut", label: "Check-out", source: "travel", required: true },
    { key: "roomType", label: "Room", source: "preferences", required: true },
    { key: "guestCount", label: "Guests", source: "travel", required: true },
    { key: "totalPrice", label: "Total", source: "computed", required: true },
  ]},
  { id: "t5", name: "Seoul Tower - Booking Form", hotelId: "h5", fields: [
    { key: "guestName", label: "Guest Name", source: "customer", required: true },
    { key: "passport", label: "Passport", source: "customer", required: true },
    { key: "checkIn", label: "Check-in", source: "travel", required: true },
    { key: "checkOut", label: "Check-out", source: "travel", required: true },
    { key: "roomType", label: "Room", source: "preferences", required: true },
    { key: "guestCount", label: "Guests", source: "travel", required: true },
    { key: "totalPrice", label: "Total", source: "computed", required: true },
  ]},
  { id: "t6", name: "Lotus Riverside - Reservation Form", hotelId: "h6", fields: [
    { key: "guestName", label: "Guest Name", source: "customer", required: true },
    { key: "passport", label: "Passport", source: "customer", required: true },
    { key: "checkIn", label: "Check-in", source: "travel", required: true },
    { key: "checkOut", label: "Check-out", source: "travel", required: true },
    { key: "roomType", label: "Room", source: "preferences", required: true },
    { key: "guestCount", label: "Guests", source: "travel", required: true },
    { key: "totalPrice", label: "Total", source: "computed", required: true },
  ]},
];

// ===== Sample Bookings =====

export const MOCK_BOOKINGS: BookingRequest[] = [
  {
    id: "b1",
    customer: { name: "Li Wei", passport: "E12345678", email: "liwei@example.com", phone: "+86-138-0000-1234", nationality: "Chinese" },
    travel: { checkIn: "2026-04-15", checkOut: "2026-04-18", guestCount: 2, roomCount: 1, destination: "Singapore" },
    preferences: { roomType: "deluxe", maxBudgetPerNight: 300, currency: "USD", specialRequests: "High floor preferred" },
    status: "confirmed",
    assignedTo: "Alice",
    createdAt: "2026-04-01T09:00:00Z",
    updatedAt: "2026-04-02T14:30:00Z",
  },
  {
    id: "b2",
    customer: { name: "Tanaka Yuki", passport: "TK8877665", email: "tanaka@example.jp", phone: "+81-90-1234-5678", nationality: "Japanese" },
    travel: { checkIn: "2026-04-20", checkOut: "2026-04-23", guestCount: 1, roomCount: 1, destination: "Phuket" },
    preferences: { roomType: "standard", maxBudgetPerNight: 150, currency: "USD", specialRequests: "" },
    status: "options_presented",
    assignedTo: "Bob",
    createdAt: "2026-04-03T11:00:00Z",
    updatedAt: "2026-04-03T15:00:00Z",
  },
  {
    id: "b3",
    customer: { name: "Sarah Johnson", passport: "US9988776", email: "sarah.j@example.com", phone: "+1-555-0199", nationality: "American" },
    travel: { checkIn: "2026-05-01", checkOut: "2026-05-05", guestCount: 2, roomCount: 1, destination: "Tokyo" },
    preferences: { roomType: "suite", maxBudgetPerNight: 400, currency: "USD", specialRequests: "Anniversary trip, any romantic setup appreciated" },
    status: "sent_to_hotel",
    assignedTo: "Alice",
    createdAt: "2026-04-02T08:00:00Z",
    updatedAt: "2026-04-03T10:00:00Z",
  },
  {
    id: "b4",
    customer: { name: "Park Jihoon", passport: "KR5544332", email: "jihoon@example.kr", phone: "+82-10-9876-5432", nationality: "Korean" },
    travel: { checkIn: "2026-04-25", checkOut: "2026-04-28", guestCount: 3, roomCount: 1, destination: "Shanghai" },
    preferences: { roomType: "deluxe", maxBudgetPerNight: 250, currency: "USD", specialRequests: "Extra bed for child" },
    status: "extracting",
    assignedTo: "Bob",
    createdAt: "2026-04-04T07:00:00Z",
    updatedAt: "2026-04-04T07:15:00Z",
  },
  {
    id: "b5",
    customer: { name: "Nguyen Minh", passport: "VN1122334", email: "minh@example.vn", phone: "+84-90-123-4567", nationality: "Vietnamese" },
    travel: { checkIn: "2026-04-10", checkOut: "2026-04-12", guestCount: 2, roomCount: 1, destination: "Seoul" },
    preferences: { roomType: "standard", maxBudgetPerNight: 120, currency: "USD", specialRequests: "" },
    status: "intake",
    assignedTo: "Alice",
    createdAt: "2026-04-04T09:30:00Z",
    updatedAt: "2026-04-04T09:30:00Z",
  },
];

// ===== Sample Chat Messages =====

export const MOCK_MESSAGES: ChatMessage[] = [
  { id: "m1", bookingId: "b5", role: "customer", content: "Hi, I need to book a hotel in Seoul for 2 people, April 10-12.", timestamp: "2026-04-04T09:30:00Z" },
  { id: "m2", bookingId: "b5", role: "agent", content: "Hello! I'd be happy to help you book a hotel in Seoul. Could you please provide me with:\n1. Your full name\n2. Passport number\n3. Any room type preference (standard, deluxe, suite)?\n4. Budget per night?", timestamp: "2026-04-04T09:30:30Z" },
  { id: "m3", bookingId: "b5", role: "customer", content: "Nguyen Minh, passport VN1122334. Standard room is fine, under $120/night.", timestamp: "2026-04-04T09:31:00Z" },
  { id: "m4", bookingId: "b5", role: "system", content: "Extracted: name=Nguyen Minh, passport=VN1122334, room=standard, budget=$120/night", timestamp: "2026-04-04T09:31:05Z" },

  { id: "m10", bookingId: "b2", role: "customer", content: "Looking for a beach hotel in Phuket, April 20-23 for myself.", timestamp: "2026-04-03T11:00:00Z" },
  { id: "m11", bookingId: "b2", role: "agent", content: "Great choice! Phuket has beautiful beaches. I found some options for you. Let me get your details first - could you share your name and passport number?", timestamp: "2026-04-03T11:00:30Z" },
  { id: "m12", bookingId: "b2", role: "customer", content: "Tanaka Yuki, passport TK8877665. Budget around $150/night, standard room.", timestamp: "2026-04-03T11:01:00Z" },
  { id: "m13", bookingId: "b2", role: "system", content: "Extracted: name=Tanaka Yuki, passport=TK8877665, dest=Phuket, room=standard, budget=$150", timestamp: "2026-04-03T11:01:05Z" },
  { id: "m14", bookingId: "b2", role: "agent", content: "Here are your options for Phuket (Apr 20-23, 3 nights):\n\n1. **Orchid Beach Resort - Garden Room** - $85/night ($255 total) ⭐ Best Value\n   Pool, WiFi, Garden View\n\n2. **Orchid Beach Resort - Ocean View** - $150/night ($450 total)\n   Pool, WiFi, Ocean View, Balcony\n\nWhich option would you prefer?", timestamp: "2026-04-03T11:02:00Z" },
];

// ===== Sample Options =====

export const MOCK_OPTIONS: BookingOption[] = [
  {
    id: "opt1", bookingId: "b2", hotelId: "h4", hotelName: "Orchid Beach Resort",
    roomType: MOCK_HOTELS[3].roomTypes[0],
    totalPrice: 255, nightCount: 3, score: 92,
    explanation: "Best value option within budget. Garden room with pool access at a beachfront resort.",
  },
  {
    id: "opt2", bookingId: "b2", hotelId: "h4", hotelName: "Orchid Beach Resort",
    roomType: MOCK_HOTELS[3].roomTypes[1],
    totalPrice: 450, nightCount: 3, score: 78,
    explanation: "Ocean view upgrade. Slightly over budget but offers premium beach experience.",
  },
];

// ===== Sample Transactions =====

export const MOCK_TRANSACTIONS: BookingTransaction[] = [
  {
    id: "tx1", bookingId: "b1", selectedOptionId: "opt-b1",
    documentUrl: "/docs/reservation-b1.pdf",
    sentAt: "2026-04-01T16:00:00Z",
    confirmedAt: "2026-04-02T14:30:00Z",
    confirmationCode: "GMB-2026-04158",
    status: "confirmed",
  },
  {
    id: "tx2", bookingId: "b3", selectedOptionId: "opt-b3",
    documentUrl: "/docs/reservation-b3.pdf",
    sentAt: "2026-04-03T10:00:00Z",
    confirmedAt: null,
    confirmationCode: null,
    status: "sent",
  },
];
