/**
 * Mock extraction service.
 * In production, replace with LLM-based extraction (e.g., Claude API).
 */
import { ExtractionResult } from "../types";

const FIELD_PATTERNS: Record<string, RegExp> = {
  name: /(?:name|i'm|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
  passport: /(?:passport|pp)\s*(?:number|no\.?|#)?\s*:?\s*([A-Z]{1,2}\d{5,9})/i,
  passportDirect: /\b([A-Z]{1,2}\d{7,9})\b/,
  email: /[\w.-]+@[\w.-]+\.\w+/,
  phone: /(\+?\d[\d\s-]{7,15})/,
  dates: /(\d{4}-\d{2}-\d{2})/g,
  dateNatural: /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:\s*[-–to]+\s*\d{1,2})?(?:,?\s*\d{4})?)/gi,
  guestCount: /(\d+)\s*(?:people|persons?|guests?|pax)/i,
  roomType: /\b(standard|deluxe|suite|superior|villa|garden|ocean)\b/i,
  budget: /(?:budget|under|max|up to|less than)\s*\$?\s*(\d+)/i,
  budgetDirect: /\$(\d+)/,
  destination: /(?:in|to|at|for)\s+(singapore|tokyo|shanghai|phuket|seoul|ho chi minh(?:\s+city)?)/i,
};

export function extractFromMessages(messages: string[]): ExtractionResult {
  const text = messages.join(" ");
  const result: ExtractionResult = {
    customer: {},
    travel: {},
    preferences: {},
    missingFields: [],
    confidence: 0,
  };

  // Name
  const nameMatch = text.match(FIELD_PATTERNS.name);
  if (nameMatch) result.customer.name = nameMatch[1].trim();

  // Passport
  const passportMatch = text.match(FIELD_PATTERNS.passport) || text.match(FIELD_PATTERNS.passportDirect);
  if (passportMatch) result.customer.passport = passportMatch[1] || passportMatch[0];

  // Email
  const emailMatch = text.match(FIELD_PATTERNS.email);
  if (emailMatch) result.customer.email = emailMatch[0];

  // Phone
  const phoneMatch = text.match(FIELD_PATTERNS.phone);
  if (phoneMatch) result.customer.phone = phoneMatch[1].trim();

  // Dates
  const dateMatches = text.match(FIELD_PATTERNS.dates);
  if (dateMatches && dateMatches.length >= 2) {
    result.travel.checkIn = dateMatches[0];
    result.travel.checkOut = dateMatches[1];
  }

  // Guest count
  const guestMatch = text.match(FIELD_PATTERNS.guestCount);
  if (guestMatch) result.travel.guestCount = parseInt(guestMatch[1]);

  // Room type
  const roomMatch = text.match(FIELD_PATTERNS.roomType);
  if (roomMatch) result.preferences.roomType = roomMatch[1].toLowerCase();

  // Budget
  const budgetMatch = text.match(FIELD_PATTERNS.budget) || text.match(FIELD_PATTERNS.budgetDirect);
  if (budgetMatch) {
    result.preferences.maxBudgetPerNight = parseInt(budgetMatch[1]);
    result.preferences.currency = "USD";
  }

  // Destination
  const destMatch = text.match(FIELD_PATTERNS.destination);
  if (destMatch) result.travel.destination = destMatch[1];

  // Calculate missing fields
  const required = ["name", "passport", "checkIn", "checkOut", "destination", "guestCount", "roomType", "maxBudgetPerNight"];
  const present = [
    result.customer.name ? "name" : null,
    result.customer.passport ? "passport" : null,
    result.travel.checkIn ? "checkIn" : null,
    result.travel.checkOut ? "checkOut" : null,
    result.travel.destination ? "destination" : null,
    result.travel.guestCount ? "guestCount" : null,
    result.preferences.roomType ? "roomType" : null,
    result.preferences.maxBudgetPerNight ? "maxBudgetPerNight" : null,
  ].filter(Boolean) as string[];

  result.missingFields = required.filter((f) => !present.includes(f));
  result.confidence = present.length / required.length;

  return result;
}

/**
 * Generate a follow-up question for missing fields.
 */
export function generateFollowUp(missingFields: string[]): string {
  const fieldLabels: Record<string, string> = {
    name: "your full name",
    passport: "your passport number",
    checkIn: "your check-in date",
    checkOut: "your check-out date",
    destination: "your destination city",
    guestCount: "the number of guests",
    roomType: "your preferred room type (standard, deluxe, or suite)",
    maxBudgetPerNight: "your budget per night",
  };

  const missing = missingFields.map((f) => fieldLabels[f] || f);

  if (missing.length === 0) {
    return "I have all the information I need. Let me find the best hotel options for you!";
  }

  if (missing.length === 1) {
    return `Could you also provide ${missing[0]}?`;
  }

  return `I still need a few details:\n${missing.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;
}
