/**
 * Ollama LLM client — talks to locally running llama3.2:3b.
 * All prompts are structured to get reliable JSON or short text from a small model.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

interface OllamaResponse {
  response: string;
  done: boolean;
}

async function generate(prompt: string, system: string, temperature = 0.3): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
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

/**
 * Extract a JSON object from LLM output, tolerating markdown fences.
 */
function parseJSON<T>(raw: string): T | null {
  // Strip markdown code fences if present
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  // Find first { ... } or [ ... ]
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

// ─── PROMPT 1: Extract booking preferences from conversation ───────────────

interface PreferencesExtraction {
  destination: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guestCount: number | null;
  roomType: string | null;
  maxBudget: number | null;
}

const PREFERENCES_SYSTEM = `You are a data extraction assistant for a travel booking agency. Your ONLY job is to extract booking preferences from a customer conversation.

Available destinations in our hotel pool: Singapore, Tokyo, Shanghai, Phuket, Seoul, Ho Chi Minh City.
Available room types: standard, deluxe, suite.

Rules:
- Output ONLY a JSON object, nothing else. No explanation.
- Use null for any field not mentioned at all.
- Dates must be YYYY-MM-DD format. If the year is not stated, assume 2026.
- For guestCount, extract the number of people/guests/persons. "2 guests", "two people", "for 2", "myself" (=1) all count. Only use null if truly never mentioned.
- For maxBudget, extract the per-night number only. Output as integer.
- For roomType, normalize to one of: standard, deluxe, suite.
- For destination, normalize to the exact city name from the list above.`;

export async function extractPreferences(conversationText: string): Promise<PreferencesExtraction> {
  const prompt = `Extract booking preferences from this conversation:

"""
${conversationText}
"""

Output JSON with keys: destination, checkIn, checkOut, guestCount, roomType, maxBudget`;

  const raw = await generate(prompt, PREFERENCES_SYSTEM, 0.1);
  const parsed = parseJSON<PreferencesExtraction>(raw);

  return parsed || {
    destination: null,
    checkIn: null,
    checkOut: null,
    guestCount: null,
    roomType: null,
    maxBudget: null,
  };
}

// ─── PROMPT 2: Generate a conversational reply during preference collection ──

const PREFERENCE_CHAT_SYSTEM = `You are a friendly travel booking assistant for a travel agency.
Your job is to help customers find a hotel. You are chatting with them to collect their booking preferences.

You need to collect: destination, check-in date, check-out date, number of guests, room type preference, and budget per night.

Rules:
- Be warm, brief, and professional. 1-3 sentences max.
- Ask for missing info naturally — don't list all missing fields robotically.
- If the customer gave some info, acknowledge it before asking for more.
- Never make up information. Never confirm a booking.
- Available destinations: Singapore, Tokyo, Shanghai, Phuket, Seoul, Ho Chi Minh City.
- Available room types: Standard, Deluxe, Suite.`;

export async function generatePreferenceReply(
  conversationHistory: string,
  knownFields: Record<string, string | number | null>,
  missingFields: string[]
): Promise<string> {
  const known = Object.entries(knownFields)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const prompt = `Conversation so far:
${conversationHistory}

Info collected so far: ${known || "none yet"}
Still missing: ${missingFields.join(", ")}

Write a short, friendly reply to the customer. Ask about the missing info naturally.`;

  return generate(prompt, PREFERENCE_CHAT_SYSTEM, 0.6);
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

  return generate(prompt, PRESENT_OPTIONS_SYSTEM, 0.5);
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

export async function parseSelection(
  customerMessage: string,
  optionCount: number
): Promise<SelectionResult> {
  const prompt = `The customer was shown ${optionCount} hotel options. They replied:
"${customerMessage}"

What is their intent? Output JSON with keys: selectedOption (number or null), intent (select/negotiate/reject/unclear)`;

  const raw = await generate(prompt, SELECTION_SYSTEM, 0.1);
  const parsed = parseJSON<SelectionResult>(raw);

  return parsed || { selectedOption: null, intent: "unclear" };
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

export async function extractPersonalInfo(messageText: string): Promise<PersonalInfoExtraction> {
  const prompt = `Extract personal information from this message:
"${messageText}"

Output JSON with keys: name, passport, nationality, email, phone`;

  const raw = await generate(prompt, PERSONAL_INFO_SYSTEM, 0.1);
  const parsed = parseJSON<PersonalInfoExtraction>(raw);

  return parsed || { name: null, passport: null, nationality: null, email: null, phone: null };
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

  return generate(prompt, CHECKLIST_CHAT_SYSTEM, 0.5);
}

// ─── Health check ───────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ ok: boolean; model: string; error?: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return { ok: false, model: MODEL, error: `HTTP ${res.status}` };
    const data = await res.json();
    const hasModel = data.models?.some((m: { name: string }) => m.name.startsWith(MODEL.split(":")[0]));
    return { ok: hasModel, model: MODEL, error: hasModel ? undefined : `Model ${MODEL} not found` };
  } catch (e) {
    return { ok: false, model: MODEL, error: String(e) };
  }
}
