/**
 * LLM service — dual provider support (Gemini cloud + Ollama local).
 *
 * Provider selection via env:
 *   LLM_PROVIDER=gemini  (default) — uses Google Gemini API
 *   LLM_PROVIDER=ollama            — uses local Ollama (qwen2.5:7b)
 *
 * All structured extraction calls use format schemas:
 *   - Ollama: `format` field with JSON Schema (constrained decoding)
 *   - Gemini: `responseMimeType: "application/json"` + `responseSchema`
 */

import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

// ─── Configuration ──────────────────────────────────────────────────────────

const LLM_PROVIDER = process.env.LLM_PROVIDER || "gemini";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const gemini = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// ─── Low-level generation ───────────────────────────────────────────────────

interface OllamaResponse {
  response: string;
  done: boolean;
}

/**
 * Generate text (no schema constraint). Used for conversational replies.
 */
async function generateText(prompt: string, system: string, temperature = 0.3): Promise<string> {
  if (LLM_PROVIDER === "gemini" && gemini) {
    return generateGeminiText(prompt, system, temperature);
  }
  return generateOllamaText(prompt, system, temperature);
}

/**
 * Generate structured JSON with schema constraint. Used for extraction.
 */
async function generateJSON<T>(
  prompt: string,
  system: string,
  schema: OllamaSchema,
  geminiSchema: Schema,
  temperature = 0.1,
): Promise<T | null> {
  if (LLM_PROVIDER === "gemini" && gemini) {
    return generateGeminiJSON<T>(prompt, system, geminiSchema, temperature);
  }
  return generateOllamaJSON<T>(prompt, system, schema, temperature);
}

// ─── Ollama backend ─────────────────────────────────────────────────────────

async function generateOllamaText(prompt: string, system: string, temperature: number): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      system,
      stream: false,
      options: { temperature, num_predict: 512 },
    }),
  });

  if (!res.ok) {
    console.error("Ollama error:", res.status, await res.text());
    throw new Error(`Ollama returned ${res.status}`);
  }

  const data: OllamaResponse = await res.json();
  return data.response.trim();
}

// Ollama JSON Schema type
interface OllamaSchema {
  type: "object";
  properties: Record<string, { type: string | string[]; enum?: string[] }>;
  required: string[];
}

async function generateOllamaJSON<T>(
  prompt: string,
  system: string,
  schema: OllamaSchema,
  temperature: number,
): Promise<T | null> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      system,
      stream: false,
      format: schema,
      options: { temperature, num_predict: 512 },
    }),
  });

  if (!res.ok) {
    console.error("Ollama error:", res.status, await res.text());
    throw new Error(`Ollama returned ${res.status}`);
  }

  const data: OllamaResponse = await res.json();
  return parseJSON<T>(data.response.trim());
}

// ─── Gemini backend ─────────────────────────────────────────────────────────

async function generateGeminiText(prompt: string, system: string, temperature: number): Promise<string> {
  if (!gemini) throw new Error("Gemini API key not configured");

  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: system,
    generationConfig: { temperature },
  });

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function generateGeminiJSON<T>(
  prompt: string,
  system: string,
  schema: Schema,
  temperature: number,
): Promise<T | null> {
  if (!gemini) throw new Error("Gemini API key not configured");

  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: system,
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();
  return parseJSON<T>(raw);
}

// ─── JSON parsing helper ────────────────────────────────────────────────────

function parseJSON<T>(raw: string): T | null {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.slice(start, end + 1);
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error("JSON parse failed for LLM output:", raw);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPTS — unchanged from before
// ═══════════════════════════════════════════════════════════════════════════

// ─── PROMPT 1: Extract booking preferences from conversation ───────────────

interface PreferencesExtraction {
  destination: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guestCount: number | null;
  roomType: string | null;
  maxBudget: number | null;
}

const PREFERENCES_SYSTEM = `You are a data extraction assistant for a travel booking agency.
Your ONLY job is to extract booking preferences that the CUSTOMER EXPLICITLY STATED in the conversation.

CRITICAL RULES:
- Output ONLY a valid JSON object. No explanation, no text before or after.
- You MUST use null for ANY field the customer has NOT explicitly mentioned. This is the most important rule.
- NEVER invent, guess, or assume values. If the customer said "UK" and nothing else, every field except destination must be null.
- Look at the ENTIRE conversation to combine info from multiple messages (e.g., "UK" in one message and "$300" in the next).

Field-specific rules:
- destination: You MUST match the customer's location to an entry from the AVAILABLE_LOCATIONS list. Use the EXACT string from the list. Neighborhoods, districts, landmarks, and abbreviations should map to their parent city (e.g. "la jolla" → "San Diego", "shibuya" → "Tokyo", "manhattan" → "New York", "camden" → "London", "NYC" → "New York"). If the customer's location genuinely does not exist in any form in the list (e.g. "Paris" when no French city is listed), output their exact input unchanged — the system will handle it. Use null if no location mentioned.
- checkIn: YYYY-MM-DD format. Year defaults to 2026 if not stated. Use null if no arrival/check-in date mentioned.
- checkOut: YYYY-MM-DD format. Year defaults to 2026 if not stated. Use null if no departure/check-out date mentioned.
- guestCount: Integer. "2 guests", "two people", "for 2", "myself"=1. Use null if never mentioned.
- roomType: One of: standard, deluxe, suite. Use null if no room preference stated or if the customer says "any", "no preference", "doesn't matter", etc.
- maxBudget: Per-night budget as integer. Extract the NUMBER the customer mentioned as their limit. "$300/night"=300, "under 200"=200, "300 dollars"=300, "budget around 150"=150, "budget-friendly"=null (no number). Use null ONLY if no number is mentioned.

Examples of correct extraction:
- Customer says "I want to visit UK" → {"destination":"UK","checkIn":null,"checkOut":null,"guestCount":null,"roomType":null,"maxBudget":null}
- Customer says "Tokyo, May 10 to 14, 2 guests" → {"destination":"Tokyo","checkIn":"2026-05-10","checkOut":"2026-05-14","guestCount":2,"roomType":null,"maxBudget":null}
- Customer says "under $300 per night, deluxe" → {"destination":null,"checkIn":null,"checkOut":null,"guestCount":null,"roomType":"deluxe","maxBudget":300}
- Two messages: first "UK", then "under 300 dollars" → {"destination":"UK","checkIn":null,"checkOut":null,"guestCount":null,"roomType":null,"maxBudget":300}`;

const PREFERENCES_OLLAMA_SCHEMA: OllamaSchema = {
  type: "object",
  properties: {
    destination: { type: ["string", "null"] },
    checkIn: { type: ["string", "null"] },
    checkOut: { type: ["string", "null"] },
    guestCount: { type: ["integer", "null"] },
    roomType: { type: ["string", "null"], enum: ["standard", "deluxe", "suite"] },
    maxBudget: { type: ["integer", "null"] },
  },
  required: ["destination", "checkIn", "checkOut", "guestCount", "roomType", "maxBudget"],
};

const PREFERENCES_GEMINI_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    destination: { type: SchemaType.STRING, nullable: true, description: "Destination city/country or null" },
    checkIn: { type: SchemaType.STRING, nullable: true, description: "Check-in date YYYY-MM-DD or null" },
    checkOut: { type: SchemaType.STRING, nullable: true, description: "Check-out date YYYY-MM-DD or null" },
    guestCount: { type: SchemaType.INTEGER, nullable: true, description: "Number of guests or null" },
    roomType: { type: SchemaType.STRING, nullable: true, format: "enum", enum: ["standard", "deluxe", "suite"], description: "Room type or null" },
    maxBudget: { type: SchemaType.INTEGER, nullable: true, description: "Max budget per night as integer or null" },
  },
  required: ["destination", "checkIn", "checkOut", "guestCount", "roomType", "maxBudget"],
};

export async function extractPreferences(
  conversationText: string,
  availableLocations: string[] = [],
): Promise<PreferencesExtraction> {
  const locationSection = availableLocations.length > 0
    ? `\nAVAILABLE_LOCATIONS (match customer's input to the closest one):\n${availableLocations.map((l) => `- ${l}`).join("\n")}\n`
    : "";

  const prompt = `Extract ONLY what the customer explicitly stated from this conversation. Use null for anything not mentioned.
${locationSection}
"""
${conversationText}
"""

JSON with keys: destination, checkIn, checkOut, guestCount, roomType, maxBudget`;

  const result = await generateJSON<PreferencesExtraction>(
    prompt,
    PREFERENCES_SYSTEM,
    PREFERENCES_OLLAMA_SCHEMA,
    PREFERENCES_GEMINI_SCHEMA,
    0.1,
  );

  const prefs = result || {
    destination: null,
    checkIn: null,
    checkOut: null,
    guestCount: null,
    roomType: null,
    maxBudget: null,
  };

  return prefs;
}

// ─── PROMPT 2: Generate a conversational reply during preference collection ──

const PREFERENCE_CHAT_SYSTEM = `You are a friendly travel booking assistant for a travel agency.
Your job is to help customers find a hotel by collecting their booking preferences one step at a time.

REQUIRED info (must collect): destination, check-in date, check-out date.
OPTIONAL info (nice to have): number of guests, room type (Standard/Deluxe/Suite), budget per night.

Rules:
- Be warm, brief, and professional. 1-3 sentences max.
- Focus on getting the REQUIRED fields first (destination, then dates).
- Once you have destination and dates, you may ask about optional preferences OR proceed to search.
- If the customer says "any" or "no preference" for room type, budget, or guest count, accept that — don't insist.
- Never make up or assume information the customer hasn't provided.
- Never confirm a booking or present options — just collect info.`;

const PREFERENCE_CHAT_CONCISE_SYSTEM = `You are a friendly travel booking assistant for a travel agency.
Your job is to help customers find a hotel by collecting ALL their booking preferences in as few messages as possible.

REQUIRED info (must collect): destination, check-in date, check-out date.
OPTIONAL info (nice to have): number of guests, room type (Standard/Deluxe/Suite), budget per night.

Rules:
- Be warm and professional. Ask for ALL missing info in a single message using a numbered list.
- If multiple fields are missing, list them all at once.
- Never make up or assume information the customer hasn't provided.
- Never confirm a booking or present options — just collect info.`;

export async function generatePreferenceReply(
  conversationHistory: string,
  knownFields: Record<string, string | number | null>,
  missingFields: string[],
  concise = false,
): Promise<string> {
  const known = Object.entries(knownFields)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const prompt = `Conversation so far:
${conversationHistory}

Info collected so far: ${known || "none yet"}
Still missing: ${missingFields.join(", ")}

${concise ? "Ask for ALL missing info in a single numbered list." : "Write a short, friendly reply to the customer. Ask about the missing info naturally."}`;

  return generateText(prompt, concise ? PREFERENCE_CHAT_CONCISE_SYSTEM : PREFERENCE_CHAT_SYSTEM, 0.6);
}

// ─── PROMPT 3: Present hotel options naturally ──────────────────────────────

const PRESENT_OPTIONS_SYSTEM = `You are a friendly travel booking assistant presenting hotel options to a customer.

Rules:
- Present options clearly with numbering.
- Highlight key selling points briefly.
- Mention price per night AND total.
- End by asking which they prefer, or if they'd like different options.
- Keep it concise — no more than 2 lines per option.`;

interface HotelOptionForLLM {
  number: number;
  hotelName: string;
  roomType: string;
  pricePerNight: number;
  totalPrice: number;
  nights: number;
  stars: number;
  amenities: string[];
  score: number;
}

export async function presentOptions(
  customerName: string,
  destination: string,
  options: HotelOptionForLLM[]
): Promise<string> {
  const optionsText = options
    .map(
      (o) =>
        `Option ${o.number}: ${o.hotelName} - ${o.roomType} | $${o.pricePerNight}/night ($${o.totalPrice} for ${o.nights} nights) | ${o.stars} stars | ${o.amenities.join(", ")}`
    )
    .join("\n");

  const prompt = `Customer "${customerName}" is looking for hotels in ${destination}.

Here are the matching options from our contracted hotel pool:
${optionsText}

Present these options to the customer in a friendly, helpful way. Number each option clearly.`;

  return generateText(prompt, PRESENT_OPTIONS_SYSTEM, 0.5);
}

// ─── PROMPT 4: Understand customer's option selection ───────────────────────

const SELECTION_SYSTEM = `You are a booking assistant. Determine which hotel option the customer selected from their message.

Rules:
- Output ONLY a JSON object with key "selectedOption" (integer 1-based) or null if unclear.
- Also include "intent": one of "select", "negotiate", "reject", "unclear".
- If they say "option 1", "first one", "the cheaper one", etc., figure out the number.
- If they ask for different options or complain about price, intent is "negotiate".`;

interface SelectionResult {
  selectedOption: number | null;
  intent: "select" | "negotiate" | "reject" | "unclear";
}

const SELECTION_OLLAMA_SCHEMA: OllamaSchema = {
  type: "object",
  properties: {
    selectedOption: { type: ["integer", "null"] },
    intent: { type: "string", enum: ["select", "negotiate", "reject", "unclear"] },
  },
  required: ["selectedOption", "intent"],
};

const SELECTION_GEMINI_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    selectedOption: { type: SchemaType.INTEGER, nullable: true, description: "1-based option number or null" },
    intent: { type: SchemaType.STRING, format: "enum", enum: ["select", "negotiate", "reject", "unclear"] },
  },
  required: ["selectedOption", "intent"],
};

export async function parseSelection(
  customerMessage: string,
  optionCount: number
): Promise<SelectionResult> {
  const prompt = `The customer was shown ${optionCount} hotel options. They replied:
"${customerMessage}"

What is their intent? Output JSON with keys: selectedOption (number or null), intent (select/negotiate/reject/unclear)`;

  const result = await generateJSON<SelectionResult>(
    prompt,
    SELECTION_SYSTEM,
    SELECTION_OLLAMA_SCHEMA,
    SELECTION_GEMINI_SCHEMA,
    0.1,
  );

  return result || { selectedOption: null, intent: "unclear" };
}

// ─── PROMPT 5: Extract personal info from message during checklist phase ────

interface PersonalInfoExtraction {
  name: string | null;
  passport: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
}

const PERSONAL_INFO_SYSTEM = `You are a data extraction assistant. Extract personal information from the customer's message.

Rules:
- Output ONLY a JSON object, nothing else.
- Use null for any field not found in the message.
- Keys: name, passport, nationality, email, phone.
- For passport, extract the alphanumeric code (e.g. "E12345678").
- For phone, include country code if present.
- Be precise — only extract what is explicitly stated.`;

const PERSONAL_INFO_OLLAMA_SCHEMA: OllamaSchema = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    passport: { type: ["string", "null"] },
    nationality: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
  },
  required: ["name", "passport", "nationality", "email", "phone"],
};

const PERSONAL_INFO_GEMINI_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING, nullable: true, description: "Full name or null" },
    passport: { type: SchemaType.STRING, nullable: true, description: "Passport number or null" },
    nationality: { type: SchemaType.STRING, nullable: true, description: "Nationality or null" },
    email: { type: SchemaType.STRING, nullable: true, description: "Email address or null" },
    phone: { type: SchemaType.STRING, nullable: true, description: "Phone number or null" },
  },
  required: ["name", "passport", "nationality", "email", "phone"],
};

export async function extractPersonalInfo(messageText: string): Promise<PersonalInfoExtraction> {
  const prompt = `Extract personal information from this message:
"${messageText}"

Output JSON with keys: name, passport, nationality, email, phone`;

  const result = await generateJSON<PersonalInfoExtraction>(
    prompt,
    PERSONAL_INFO_SYSTEM,
    PERSONAL_INFO_OLLAMA_SCHEMA,
    PERSONAL_INFO_GEMINI_SCHEMA,
    0.1,
  );

  return result || { name: null, passport: null, nationality: null, email: null, phone: null };
}

// ─── PROMPT 6: Generate checklist follow-up during info collection ──────────

const CHECKLIST_CHAT_SYSTEM = `You are a friendly booking assistant collecting personal details from a customer to complete their hotel reservation.

Rules:
- Be warm and brief. 1-3 sentences.
- Acknowledge any info they just provided.
- Ask for the remaining missing items naturally.
- Required: full name, passport number, nationality, email, phone number.
- When all info is collected, confirm you have everything and let them know you'll proceed.`;

export async function generateChecklistReply(
  conversationSnippet: string,
  collectedFields: Record<string, string | null>,
  missingFields: string[]
): Promise<string> {
  const collected = Object.entries(collectedFields)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const prompt = `Recent conversation:
${conversationSnippet}

Personal info collected: ${collected || "none yet"}
Still missing: ${missingFields.join(", ") || "NONE — all collected!"}

${missingFields.length === 0
    ? "All info is collected. Confirm to the customer that you have everything and will now process their reservation."
    : "Write a short, friendly reply asking for the missing info."}`;

  return generateText(prompt, CHECKLIST_CHAT_SYSTEM, 0.5);
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY DETECTION
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_SYSTEM = `You are a booking assistant classifier. Determine what type(s) of booking the customer wants from their message.

Rules:
- Output ONLY a valid JSON object with key "categories" (an array of strings).
- Include ALL categories the customer mentions or implies. They may want multiple bookings.
- Valid values: "hotel", "flight", "restaurant"
- "hotel" — if they mention hotel, accommodation, room, stay, lodge, resort, inn, motel, hostel
- "flight" — if they mention flight, fly, airplane, airline, ticket, plane, airport, travel to (with transport implied)
- "restaurant" — if they mention restaurant, dinner, lunch, breakfast, brunch, table, dining, eat, food, reservation for eating
- If they say "all", "everything", "all three", "the works" → include all three: ["hotel", "flight", "restaurant"]
- If they say "hotel and flight", "stay and fly" → include both mentioned
- Return empty array [] ONLY if you truly cannot determine any category

Examples:
- "I need a hotel" → {"categories":["hotel"]}
- "book me a flight and hotel" → {"categories":["flight","hotel"]}
- "all" or "everything" → {"categories":["hotel","flight","restaurant"]}
- "I want to fly to Tokyo and find a place to eat" → {"categories":["flight","restaurant"]}`;

interface CategoryDetection {
  categories: ("hotel" | "flight" | "restaurant")[];
}

const CATEGORY_OLLAMA_SCHEMA: OllamaSchema = {
  type: "object",
  properties: {
    categories: { type: "string" },
  },
  required: ["categories"],
};

const CATEGORY_GEMINI_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    categories: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING, format: "enum", enum: ["hotel", "flight", "restaurant"] }, description: "Array of booking categories" },
  },
  required: ["categories"],
};

export async function detectCategory(message: string): Promise<CategoryDetection> {
  const prompt = `What type(s) of booking does this customer want? They may want multiple.
"${message}"

Output JSON with key: categories (array of: hotel, flight, restaurant)`;

  const result = await generateJSON<CategoryDetection>(
    prompt,
    CATEGORY_SYSTEM,
    CATEGORY_OLLAMA_SCHEMA,
    CATEGORY_GEMINI_SCHEMA,
    0.1,
  );

  // Normalize: ensure we always return an array
  if (result && Array.isArray(result.categories) && result.categories.length > 0) {
    return result;
  }

  return { categories: [] };
}

// ═══════════════════════════════════════════════════════════════════════════
// FLIGHT PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── FLIGHT PROMPT 1: Extract flight preferences ─────────────────────────────

interface FlightPreferencesExtraction {
  origin: string | null;
  destination: string | null;
  departureDate: string | null;
  returnDate: string | null;
  passengers: number | null;
  cabinClass: string | null;
  maxBudget: number | null;
}

const FLIGHT_PREFERENCES_SYSTEM = `You are a data extraction assistant for a travel booking agency.
Your ONLY job is to extract flight booking preferences that the CUSTOMER EXPLICITLY STATED in the conversation.

CRITICAL RULES:
- Output ONLY a valid JSON object. No explanation, no text before or after.
- You MUST use null for ANY field the customer has NOT explicitly mentioned in their latest message(s).
- NEVER invent, guess, or assume values.
- Look at the ENTIRE conversation to combine info from multiple messages.
- PAY CLOSE ATTENTION to what the agent ASKED FOR. If the agent asked "What's your departure city?" and the customer replies with a city name, that city is the ORIGIN (departure), NOT the destination.
- If ALREADY_KNOWN fields are provided, those fields are already set. Do NOT re-extract them unless the customer EXPLICITLY says they want to change them (e.g. "change destination to X", "actually fly to Y instead"). A customer simply providing new info for missing fields does NOT change already-known fields.

Field-specific rules:
- origin: The departure city/airport (where the customer is FLYING FROM). Match to AVAILABLE_ORIGINS if provided. Use null if not mentioned.
- destination: The arrival city/airport (where the customer is FLYING TO). Match to AVAILABLE_DESTINATIONS if provided. Use null if not mentioned.
- departureDate: YYYY-MM-DD format. Year defaults to 2026 if not stated. Use null if no departure date mentioned.
- returnDate: YYYY-MM-DD format. Year defaults to 2026. Use null if not mentioned or one-way trip.
- passengers: Integer. "2 tickets", "for 2", "myself"=1. Use null if never mentioned.
- cabinClass: One of: Economy, Premium Economy, Business, First. Use null if no preference stated.
- maxBudget: Total budget per person as integer. "$800"=800, "under 1000"=1000. Use null if no number mentioned.`;

const FLIGHT_PREFS_OLLAMA_SCHEMA: OllamaSchema = {
  type: "object",
  properties: {
    origin: { type: ["string", "null"] },
    destination: { type: ["string", "null"] },
    departureDate: { type: ["string", "null"] },
    returnDate: { type: ["string", "null"] },
    passengers: { type: ["integer", "null"] },
    cabinClass: { type: ["string", "null"], enum: ["Economy", "Premium Economy", "Business", "First"] },
    maxBudget: { type: ["integer", "null"] },
  },
  required: ["origin", "destination", "departureDate", "returnDate", "passengers", "cabinClass", "maxBudget"],
};

const FLIGHT_PREFS_GEMINI_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    origin: { type: SchemaType.STRING, nullable: true, description: "Departure city/airport or null" },
    destination: { type: SchemaType.STRING, nullable: true, description: "Arrival city/airport or null" },
    departureDate: { type: SchemaType.STRING, nullable: true, description: "Departure date YYYY-MM-DD or null" },
    returnDate: { type: SchemaType.STRING, nullable: true, description: "Return date YYYY-MM-DD or null" },
    passengers: { type: SchemaType.INTEGER, nullable: true, description: "Number of passengers or null" },
    cabinClass: { type: SchemaType.STRING, nullable: true, format: "enum", enum: ["Economy", "Premium Economy", "Business", "First"], description: "Cabin class or null" },
    maxBudget: { type: SchemaType.INTEGER, nullable: true, description: "Max budget per person as integer or null" },
  },
  required: ["origin", "destination", "departureDate", "returnDate", "passengers", "cabinClass", "maxBudget"],
};

export async function extractFlightPreferences(
  conversationText: string,
  availableRoutes: { origins: string[]; destinations: string[] } = { origins: [], destinations: [] },
  knownFields: Record<string, string | number | null> = {},
): Promise<FlightPreferencesExtraction> {
  const routeSection = (availableRoutes.origins.length > 0 || availableRoutes.destinations.length > 0)
    ? `\nAVAILABLE_ORIGINS (match customer's input to the closest one):\n${availableRoutes.origins.map((o) => `- ${o}`).join("\n")}\n\nAVAILABLE_DESTINATIONS:\n${availableRoutes.destinations.map((d) => `- ${d}`).join("\n")}\n`
    : "";

  // Build known-fields context so the LLM doesn't re-extract or misassign
  const knownEntries = Object.entries(knownFields).filter(([, v]) => v !== null && v !== "" && v !== 0);
  const knownSection = knownEntries.length > 0
    ? `\nALREADY_KNOWN (these are already set — use null for these unless the customer EXPLICITLY wants to change them):\n${knownEntries.map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\nThe customer's new message likely provides info for the MISSING fields, not the already-known ones.\n`
    : "";

  const prompt = `Extract ONLY what the customer explicitly stated from this conversation. Use null for anything not mentioned.
${routeSection}${knownSection}
"""
${conversationText}
"""

JSON with keys: origin, destination, departureDate, returnDate, passengers, cabinClass, maxBudget`;

  const result = await generateJSON<FlightPreferencesExtraction>(
    prompt,
    FLIGHT_PREFERENCES_SYSTEM,
    FLIGHT_PREFS_OLLAMA_SCHEMA,
    FLIGHT_PREFS_GEMINI_SCHEMA,
    0.1,
  );

  return result || { origin: null, destination: null, departureDate: null, returnDate: null, passengers: null, cabinClass: null, maxBudget: null };
}

// ─── FLIGHT PROMPT 2: Generate conversational reply during preference collection ──

const FLIGHT_PREF_CHAT_SYSTEM = `You are a friendly travel booking assistant for a travel agency.
Your job is to help customers find a flight by collecting their booking preferences one step at a time.

REQUIRED info (must collect): departure city/airport, destination city/airport, departure date.
OPTIONAL info (nice to have): return date, number of passengers, cabin class (Economy/Premium Economy/Business/First), budget.

Rules:
- Be warm, brief, and professional. 1-3 sentences max.
- Focus on getting the REQUIRED fields first.
- Once you have origin, destination, and departure date, you may ask about optional preferences OR proceed to search.
- If the customer says "any" or "no preference" for cabin class or budget, accept that.
- Never make up or assume information the customer hasn't provided.
- Never confirm a booking or present options — just collect info.`;

export async function generateFlightPreferenceReply(
  conversationHistory: string,
  knownFields: Record<string, string | number | null>,
  missingFields: string[],
  concise = false,
): Promise<string> {
  const known = Object.entries(knownFields)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const prompt = `Conversation so far:
${conversationHistory}

Info collected so far: ${known || "none yet"}
Still missing: ${missingFields.join(", ")}

${concise ? "Ask for ALL missing info in a single numbered list." : "Write a short, friendly reply to the customer. Ask about the missing info naturally."}`;

  return generateText(prompt, FLIGHT_PREF_CHAT_SYSTEM, 0.6);
}

// ─── FLIGHT PROMPT 3: Present flight options naturally ────────────────────────

const PRESENT_FLIGHTS_SYSTEM = `You are a friendly travel booking assistant presenting flight options to a customer.

Rules:
- Present options clearly with numbering.
- Highlight airline, route, cabin class, and price.
- Mention departure date.
- End by asking which they prefer, or if they'd like different options.
- Keep it concise — no more than 2 lines per option.`;

interface FlightOptionForLLM {
  number: number;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass: string;
  price: number;
  score: number;
}

export async function presentFlightOptions(
  customerName: string,
  route: string,
  options: FlightOptionForLLM[]
): Promise<string> {
  const optionsText = options
    .map(
      (o) =>
        `Option ${o.number}: ${o.airline} ${o.flightNumber} | ${o.origin} → ${o.destination} | ${o.cabinClass} | $${o.price}/person | Departs: ${o.departureDate}`
    )
    .join("\n");

  const prompt = `Customer "${customerName}" is looking for flights on the ${route} route.

Here are the matching flight options:
${optionsText}

Present these options to the customer in a friendly, helpful way. Number each option clearly.`;

  return generateText(prompt, PRESENT_FLIGHTS_SYSTEM, 0.5);
}

// ═══════════════════════════════════════════════════════════════════════════
// RESTAURANT PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── RESTAURANT PROMPT 1: Extract restaurant preferences ─────────────────────

interface RestaurantPreferencesExtraction {
  location: string | null;
  date: string | null;
  time: string | null;
  partySize: number | null;
  cuisine: string | null;
  priceRange: string | null;
}

const RESTAURANT_PREFERENCES_SYSTEM = `You are a data extraction assistant for a restaurant booking agency.
Your ONLY job is to extract restaurant booking preferences that the CUSTOMER EXPLICITLY STATED in the conversation.

CRITICAL RULES:
- Output ONLY a valid JSON object. No explanation, no text before or after.
- You MUST use null for ANY field the customer has NOT explicitly mentioned in their latest message(s).
- NEVER invent, guess, or assume values.
- Look at the ENTIRE conversation to combine info from multiple messages.
- PAY CLOSE ATTENTION to what the agent ASKED FOR. If the agent asked for a specific field and the customer responds, map their answer to that field.
- If ALREADY_KNOWN fields are provided, those fields are already set. Do NOT re-extract them unless the customer EXPLICITLY says they want to change them.

Field-specific rules:
- location: The city or area. Match to AVAILABLE_LOCATIONS if provided. Use null if not mentioned.
- date: YYYY-MM-DD format. Year defaults to 2026 if not stated. "tonight" = today's date, "tomorrow" = tomorrow. Use null if not mentioned.
- time: 24-hour format "HH:MM". "7pm"="19:00", "noon"="12:00", "dinner"=null (too vague). Use null if not mentioned.
- partySize: Integer. "table for 4"=4, "two of us"=2, "myself"=1. Use null if never mentioned.
- cuisine: The type of food. "Italian", "sushi", "Mexican", etc. Use null if no preference stated.
- priceRange: One of: "10-20", "20-30", "30-50", "50-100", "100+". Map from customer input: "cheap"="10-20", "moderate"="30-50", "upscale"="50-100", "fine dining"="100+". Use null if not mentioned.`;

const RESTAURANT_PREFS_OLLAMA_SCHEMA: OllamaSchema = {
  type: "object",
  properties: {
    location: { type: ["string", "null"] },
    date: { type: ["string", "null"] },
    time: { type: ["string", "null"] },
    partySize: { type: ["integer", "null"] },
    cuisine: { type: ["string", "null"] },
    priceRange: { type: ["string", "null"], enum: ["10-20", "20-30", "30-50", "50-100", "100+"] },
  },
  required: ["location", "date", "time", "partySize", "cuisine", "priceRange"],
};

const RESTAURANT_PREFS_GEMINI_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    location: { type: SchemaType.STRING, nullable: true, description: "City or area or null" },
    date: { type: SchemaType.STRING, nullable: true, description: "Date YYYY-MM-DD or null" },
    time: { type: SchemaType.STRING, nullable: true, description: "Time HH:MM or null" },
    partySize: { type: SchemaType.INTEGER, nullable: true, description: "Number of guests or null" },
    cuisine: { type: SchemaType.STRING, nullable: true, description: "Cuisine type or null" },
    priceRange: { type: SchemaType.STRING, nullable: true, format: "enum", enum: ["10-20", "20-30", "30-50", "50-100", "100+"], description: "Price range per person or null" },
  },
  required: ["location", "date", "time", "partySize", "cuisine", "priceRange"],
};

export async function extractRestaurantPreferences(
  conversationText: string,
  availableLocations: string[] = [],
  knownFields: Record<string, string | number | null> = {},
): Promise<RestaurantPreferencesExtraction> {
  const locationSection = availableLocations.length > 0
    ? `\nAVAILABLE_LOCATIONS (match customer's input to the closest one):\n${availableLocations.map((l) => `- ${l}`).join("\n")}\n`
    : "";

  const knownEntries = Object.entries(knownFields).filter(([, v]) => v !== null && v !== "" && v !== 0);
  const knownSection = knownEntries.length > 0
    ? `\nALREADY_KNOWN (these are already set — use null for these unless the customer EXPLICITLY wants to change them):\n${knownEntries.map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\nThe customer's new message likely provides info for the MISSING fields, not the already-known ones.\n`
    : "";

  const prompt = `Extract ONLY what the customer explicitly stated from this conversation. Use null for anything not mentioned.
${locationSection}${knownSection}
"""
${conversationText}
"""

JSON with keys: location, date, time, partySize, cuisine, priceRange`;

  const result = await generateJSON<RestaurantPreferencesExtraction>(
    prompt,
    RESTAURANT_PREFERENCES_SYSTEM,
    RESTAURANT_PREFS_OLLAMA_SCHEMA,
    RESTAURANT_PREFS_GEMINI_SCHEMA,
    0.1,
  );

  return result || { location: null, date: null, time: null, partySize: null, cuisine: null, priceRange: null };
}

// ─── RESTAURANT PROMPT 2: Generate conversational reply during preference collection ──

const RESTAURANT_PREF_CHAT_SYSTEM = `You are a friendly restaurant booking assistant.
Your job is to help customers find a restaurant by collecting their preferences one step at a time.

REQUIRED info (must collect): location/city, date, time.
OPTIONAL info (nice to have): party size, cuisine preference, price range.

Rules:
- Be warm, brief, and professional. 1-3 sentences max.
- Focus on getting the REQUIRED fields first (location, then date and time).
- Once you have location, date, and time, you may ask about optional preferences OR proceed to search.
- If the customer says "any" or "no preference" for cuisine or price, accept that.
- Never make up or assume information the customer hasn't provided.
- Never confirm a booking or present options — just collect info.`;

export async function generateRestaurantPreferenceReply(
  conversationHistory: string,
  knownFields: Record<string, string | number | null>,
  missingFields: string[],
  concise = false,
): Promise<string> {
  const known = Object.entries(knownFields)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const prompt = `Conversation so far:
${conversationHistory}

Info collected so far: ${known || "none yet"}
Still missing: ${missingFields.join(", ")}

${concise ? "Ask for ALL missing info in a single numbered list." : "Write a short, friendly reply to the customer. Ask about the missing info naturally."}`;

  return generateText(prompt, RESTAURANT_PREF_CHAT_SYSTEM, 0.6);
}

// ─── RESTAURANT PROMPT 3: Present restaurant options naturally ────────────────

const PRESENT_RESTAURANTS_SYSTEM = `You are a friendly restaurant booking assistant presenting dining options to a customer.

Rules:
- Present options clearly with numbering.
- Highlight restaurant name, cuisine, location, price range, and rating.
- Mention key amenities briefly.
- End by asking which they prefer, or if they'd like different options.
- Keep it concise — no more than 2 lines per option.`;

interface RestaurantOptionForLLM {
  number: number;
  restaurantName: string;
  cuisine: string;
  location: string;
  priceRange: string;
  rating: number;
  amenities: string[];
  score: number;
}

export async function presentRestaurantOptions(
  customerName: string,
  location: string,
  options: RestaurantOptionForLLM[]
): Promise<string> {
  const optionsText = options
    .map(
      (o) =>
        `Option ${o.number}: ${o.restaurantName} | ${o.cuisine} | ${o.location} | $${o.priceRange}/person | ${o.rating} stars | ${o.amenities.slice(0, 3).join(", ")}`
    )
    .join("\n");

  const prompt = `Customer "${customerName}" is looking for a restaurant in ${location}.

Here are the matching restaurant options:
${optionsText}

Present these options to the customer in a friendly, helpful way. Number each option clearly.`;

  return generateText(prompt, PRESENT_RESTAURANTS_SYSTEM, 0.5);
}

// ─── Cancel intent detection (regex-only, no LLM call) ─────────────────────

const CANCEL_PATTERN =
  /\b(cancel\s*(my\s*)?(booking|reservation|trip|order)?|nevermind|never\s*mind|forget\s*it|changed?\s*my\s*mind|stop\s*(the\s*)?(booking|reservation)|call\s*it\s*off|i\s*(don'?t|do\s*not)\s*want\s*(it|this|the\s*booking)\s*(anymore)?)\b/i;

export function detectCancelIntent(message: string): { intent: "cancel" | "none" } {
  return { intent: CANCEL_PATTERN.test(message) ? "cancel" : "none" };
}

// ─── Health check ───────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ ok: boolean; provider: string; model: string; error?: string }> {
  const provider = LLM_PROVIDER;

  if (provider === "gemini") {
    if (!GEMINI_API_KEY) {
      return { ok: false, provider, model: GEMINI_MODEL, error: "GEMINI_API_KEY not set" };
    }
    try {
      const model = gemini!.getGenerativeModel({ model: GEMINI_MODEL });
      const result = await model.generateContent("Reply with just: OK");
      const text = result.response.text().trim();
      return { ok: text.includes("OK"), provider, model: GEMINI_MODEL };
    } catch (e) {
      return { ok: false, provider, model: GEMINI_MODEL, error: String(e) };
    }
  }

  // Ollama
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return { ok: false, provider, model: OLLAMA_MODEL, error: `HTTP ${res.status}` };
    const data = await res.json();
    const hasModel = data.models?.some((m: { name: string }) => m.name.startsWith(OLLAMA_MODEL.split(":")[0]));
    return { ok: hasModel, provider, model: OLLAMA_MODEL, error: hasModel ? undefined : `Model ${OLLAMA_MODEL} not found` };
  } catch (e) {
    return { ok: false, provider, model: OLLAMA_MODEL, error: String(e) };
  }
}
