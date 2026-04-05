/**
 * Demo walkthrough script — sends preset messages to simulate a full
 * multi-category booking flow (hotel + flight + restaurant).
 *
 * Usage: Navigate to /book?demo=true and click "Start Demo"
 *
 * Flow:
 * 1. Customer requests all three categories in London
 * 2. Hotel: provides dates + guests → selects option → provides personal info → payment simulated
 * 3. Flight: provides departure city + class → selects option → payment simulated
 * 4. Restaurant: provides time + cuisine → selects option → confirmed (no payment for restaurants)
 */

export interface DemoStep {
  type: "message" | "wait" | "select_option" | "simulate_payment";
  content?: string;
  optionIndex?: number;
  delayMs: number;
  label: string; // human-readable description for the progress UI
}

export const DEMO_STEPS: DemoStep[] = [
  // ── Intro: request all three categories ──
  { type: "message", content: "Hi! I'd like to book a hotel, flight, and restaurant in London for a trip in August.", delayMs: 2000, label: "Requesting all three bookings" },

  // ── Hotel: provide preferences ──
  { type: "wait", delayMs: 3000, label: "Waiting for hotel preference questions..." },
  { type: "message", content: "August 4 to 10, 2 guests, budget around $200 per night", delayMs: 2500, label: "Providing hotel preferences" },

  // ── Hotel: select option ──
  { type: "wait", delayMs: 3000, label: "Waiting for hotel options..." },
  { type: "select_option", optionIndex: 0, delayMs: 1500, label: "Selecting hotel option" },

  // ── Hotel: provide personal info (all at once) ──
  { type: "wait", delayMs: 2000, label: "Waiting for personal info request..." },
  { type: "message", content: "Oscar Khaing, MF449449, Myanmar, akhaing@ucsd.edu, 858-319-5972", delayMs: 2500, label: "Providing personal details" },

  // ── Hotel: simulate payment ──
  { type: "wait", delayMs: 3000, label: "Waiting for payment link..." },
  { type: "simulate_payment", delayMs: 2000, label: "Simulating hotel payment" },

  // ── Flight: provide missing details (departure city + class) ──
  { type: "wait", delayMs: 3000, label: "Waiting for flight transition..." },
  { type: "message", content: "San Diego, economy class", delayMs: 2500, label: "Providing flight details" },

  // ── Flight: select option ──
  { type: "wait", delayMs: 3000, label: "Waiting for flight options..." },
  { type: "select_option", optionIndex: 0, delayMs: 1500, label: "Selecting flight option" },

  // ── Flight: simulate payment (personal info already collected) ──
  { type: "wait", delayMs: 3000, label: "Waiting for flight payment..." },
  { type: "simulate_payment", delayMs: 2000, label: "Simulating flight payment" },

  // ── Restaurant: provide missing details ──
  { type: "wait", delayMs: 3000, label: "Waiting for restaurant transition..." },
  { type: "message", content: "7pm, Indian food, moderate price", delayMs: 2500, label: "Providing restaurant details" },

  // ── Restaurant: select option ──
  { type: "wait", delayMs: 3000, label: "Waiting for restaurant options..." },
  { type: "select_option", optionIndex: 0, delayMs: 1500, label: "Selecting restaurant option" },

  // ── Done! ──
  { type: "wait", delayMs: 2000, label: "All bookings confirmed! 🎉" },
];

/**
 * Execute the demo walkthrough.
 *
 * @param bookingId - The active booking ID
 * @param onStep - Callback fired before each step with step index and label
 * @param onRefresh - Callback to refresh messages/booking state from the API
 * @returns Promise that resolves when demo is complete
 */
export async function runDemo(
  bookingId: string,
  onStep: (stepIndex: number, label: string) => void,
  onRefresh: () => Promise<void>,
): Promise<void> {
  for (let i = 0; i < DEMO_STEPS.length; i++) {
    const step = DEMO_STEPS[i];
    onStep(i, step.label);

    // Wait the specified delay (simulates typing/thinking time)
    await sleep(step.delayMs);

    switch (step.type) {
      case "message":
        await sendMessage(bookingId, step.content!);
        await onRefresh();
        break;

      case "select_option":
        await selectOption(bookingId, step.optionIndex!);
        await onRefresh();
        break;

      case "simulate_payment":
        await simulatePayment(bookingId);
        await onRefresh();
        break;

      case "wait":
        await onRefresh();
        break;
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendMessage(bookingId: string, content: string): Promise<void> {
  await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, content, role: "customer" }),
  });
}

async function selectOption(bookingId: string, optionIndex: number): Promise<void> {
  // We need to find the option ID from the store — fetch messages and find the latest options
  const res = await fetch(`/api/chat?bookingId=${bookingId}`);
  const messages = await res.json();

  // Find the latest message with options metadata
  const optionMsg = [...messages].reverse().find(
    (m: { metadata?: { type: string; options?: { optionId: string }[] } }) =>
      m.metadata?.type === "hotel_options" ||
      m.metadata?.type === "flight_options" ||
      m.metadata?.type === "restaurant_options"
  );

  const optionId = optionMsg?.metadata?.options?.[optionIndex]?.optionId || "unknown";

  await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId,
      content: `I'll take option ${optionIndex + 1}`,
      role: "customer",
      metadata: { type: "option_selected", optionIndex, optionId },
    }),
  });
}

async function simulatePayment(bookingId: string): Promise<void> {
  await fetch("/api/demo/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId }),
  });
}
