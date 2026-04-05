/**
 * In-memory store for the MVP.
 * Replace with a real database when integrating.
 */
import {
  BookingRequest,
  TemplateRecord,
  ChatMessage,
  BookingOption,
  BookingTransaction,
} from "./types";
import {
  MOCK_BOOKINGS,
  MOCK_TEMPLATES,
  MOCK_MESSAGES,
  MOCK_OPTIONS,
  MOCK_TRANSACTIONS,
} from "./mock-data";

// Deep clone to avoid mutation of original mock data
function clone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

class Store {
  bookings: BookingRequest[] = clone(MOCK_BOOKINGS);
  templates: TemplateRecord[] = clone(MOCK_TEMPLATES);
  messages: ChatMessage[] = clone(MOCK_MESSAGES);
  options: BookingOption[] = clone(MOCK_OPTIONS);
  transactions: BookingTransaction[] = clone(MOCK_TRANSACTIONS);

  // ----- Bookings -----
  getBookings(): BookingRequest[] {
    return this.bookings;
  }

  getBooking(id: string): BookingRequest | undefined {
    return this.bookings.find((b) => b.id === id);
  }

  createBooking(booking: BookingRequest): BookingRequest {
    this.bookings.push(booking);
    return booking;
  }

  updateBooking(id: string, updates: Partial<BookingRequest>): BookingRequest | undefined {
    const idx = this.bookings.findIndex((b) => b.id === id);
    if (idx === -1) return undefined;
    this.bookings[idx] = { ...this.bookings[idx], ...updates, updatedAt: new Date().toISOString() };
    return this.bookings[idx];
  }

  // ----- Templates -----
  getTemplates(): TemplateRecord[] {
    return this.templates;
  }

  getTemplate(id: string): TemplateRecord | undefined {
    return this.templates.find((t) => t.id === id);
  }

  getTemplateForHotel(hotelId: string): TemplateRecord | undefined {
    return this.templates.find((t) => t.hotelId === hotelId);
  }

  // ----- Messages -----
  getMessages(bookingId: string): ChatMessage[] {
    return this.messages.filter((m) => m.bookingId === bookingId);
  }

  addMessage(message: ChatMessage): ChatMessage {
    this.messages.push(message);
    return message;
  }

  // ----- Options -----
  getOptions(bookingId: string): BookingOption[] {
    return this.options.filter((o) => o.bookingId === bookingId);
  }

  addOptions(options: BookingOption[]): void {
    this.options.push(...options);
  }

  // ----- Options -----
  clearOptions(bookingId: string): void {
    this.options = this.options.filter((o) => o.bookingId !== bookingId);
  }

  // ----- Transactions -----
  getTransaction(bookingId: string): BookingTransaction | undefined {
    return this.transactions.find((t) => t.bookingId === bookingId);
  }

  getLatestTransaction(bookingId: string): BookingTransaction | undefined {
    const txs = this.transactions.filter((t) => t.bookingId === bookingId);
    return txs[txs.length - 1];
  }

  createTransaction(tx: BookingTransaction): BookingTransaction {
    this.transactions.push(tx);
    return tx;
  }

  updateTransaction(id: string, updates: Partial<BookingTransaction>): BookingTransaction | undefined {
    const idx = this.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    this.transactions[idx] = { ...this.transactions[idx], ...updates };
    return this.transactions[idx];
  }
}

// Singleton — survives across API route calls within the same server process
const globalStore = globalThis as unknown as { __store?: Store };
if (!globalStore.__store) {
  globalStore.__store = new Store();
}

export const store: Store = globalStore.__store;
