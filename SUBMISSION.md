## Inspiration

will fill in

## What it does

Operon is an AI-powered booking operations platform that allows customers to book **hotels, flights, and restaurant reservations** entirely through natural conversation — no forms, no dropdowns, no multi-page checkout flows. A customer simply messages the chatbot, says what they need, and the AI handles everything from preference extraction to option matching, payment processing, and sending real confirmation emails to providers.

**For the customer**, the experience is a single chat interface. They can say something like *"I need a hotel, flight, and restaurant in London for August"* and the AI will:
1. Detect all three booking categories from their message
2. Walk them through hotel preferences first (dates, budget, room type)
3. Present scored and ranked options as interactive cards
4. Collect personal details (name, passport, email, phone) — only once across all three bookings
5. Process payment via Stripe
6. Send a real reservation confirmation email to the provider
7. Automatically transition to the flight booking, **pre-filling** the destination, dates, and passenger count from the hotel data — so the customer only needs to provide their departure city and cabin class
8. After the flight, transition to the restaurant, again pre-filling location, date, and party size
9. Display a live trip summary card showing all confirmed bookings

**For the travel company operator**, there's a full admin dashboard with:
- A real-time chat view that mirrors every customer conversation as it happens
- A booking pipeline (kanban-style) showing all bookings across workflow stages
- Per-booking detail pages with editable fields, option history, and contract generation
- Inventory management pages for hotels, flights, and restaurants
- The ability to step into any conversation as a human agent, bypassing the AI

The system also works on **Instagram DMs** — customers can message the company's Instagram account and the same AI agent responds, with the conversation flowing into the operator dashboard.

## How we built it

**Architecture**: Next.js 16 (React 19) for the frontend and API routes, Express.js + MongoDB for the backend inventory/booking data layer, Google Gemini as the LLM provider, Stripe for payments, and Resend for transactional emails.

**The AI workflow engine** is the core of the system — a state machine in `workflow.ts` that drives each booking through well-defined stages: `intake → extracting → matching → options_presented → selected → collecting_info → awaiting_payment → confirmed`. At each stage, the engine decides whether to call the LLM (for understanding customer messages) or use rule-based logic (for matching, scoring, dispatch).

**LLM integration** uses structured JSON extraction with schema constraints — we don't rely on free-text LLM output. Each extraction call (preferences, personal info, category detection) has a defined JSON schema that the LLM must conform to, using Gemini's `responseMimeType: "application/json"` with `responseSchema`. This prevents hallucination and makes outputs deterministic enough to drive a state machine.

**The matching engine** scores options against customer preferences. For hotels, it evaluates price fit (within budget), star rating, room type match, and guest capacity. For flights, it scores price, cabin class match, and seat availability. For restaurants, it weighs rating, cuisine match, price range fit, and amenity count. All scored 0-100 with a minimum threshold of 30.

**Multi-category booking** was one of the hardest pieces. When a customer books hotel + flight + restaurant, the system uses a `crossPopulateNextCategory()` function that intelligently transfers data between categories — hotel check-in date becomes the flight departure date, guest count becomes passenger count, hotel destination becomes restaurant location. The customer's personal info (collected once for the first booking) is automatically reused for subsequent ones, skipping redundant questions. For restaurants, the system is smart enough to only ask for name, email, and phone — no passport or nationality needed.

**Development approach**: We started with a hotel-only chatbot running on a local Ollama model (Llama 3.2 3B), got the core workflow working, then migrated to Google Gemini for production quality. We built the MongoDB inventory layer, added real PDF generation and email dispatch via Resend, integrated Instagram DMs, then expanded the entire system to support flights and restaurants as first-class booking categories alongside hotels. Stripe payment integration was added to handle real transactions before dispatch.

## Challenges we ran into

**LLM extraction reliability** was our biggest ongoing challenge. Early on with the 3B local model, the LLM would hallucinate values — inventing dates the customer never mentioned, or filling in "standard" as room type when the customer said "any." We solved this with aggressive prompt engineering: explicit instructions like *"You MUST use null for ANY field the customer has NOT explicitly mentioned"* with concrete examples, plus structured JSON schema constraints that force the output format.

**Location standardization** was a subtle but critical problem. Our hotel database stores locations like `"Shinjuku, Tokyo"` but customers say things like "UK", "LA", or "shibuya." We built a pipeline where the LLM receives the list of available locations and maps customer input to exact database entries — `"uk" → "London"`, `"la jolla" → "San Diego"`. For flights, we hit an additional issue: airport codes in parentheses like `"San Diego (SAN)"` broke MongoDB's regex queries because `(` and `)` are regex special characters. We added a `stripCode()` sanitization layer at the API boundary.

**Cross-category field misassignment** was a tricky bug. When transitioning from hotel to flight, the chatbot would pre-fill the destination as "London" and ask for the departure city. But when the customer replied "Paris", the LLM mapped it to `destination` instead of `origin` — because the LLM's default bias associates city names with destinations. We fixed this by passing an `ALREADY_KNOWN` context to the extraction prompt, so the LLM knows which fields are already set and maps new input to the missing fields instead.

**State management across multi-category bookings** required careful coordination. The booking goes through the full state machine cycle (intake → confirmed) for each category, then resets to `extracting` for the next. We had to track `completedCategories`, `activeCategory`, and `confirmedBookings` separately, and handle edge cases like: what if the customer wants to change a pre-filled field? What if they only booked one category but want to add another after confirmation? What if Stripe payment fails mid-flow?

## Accomplishments that we're proud of

- **True end-to-end**: A customer can go from "hi" to receiving a real confirmation email in their inbox, with Stripe payment processed, in under 2 minutes of conversation. There are no fake steps — the emails are real, the payments are real, the booking data persists in MongoDB.

- **Multi-category intelligence**: The cross-population system that carries data from hotel → flight → restaurant is genuinely useful. When you book a hotel in London for Aug 4-10 with 2 guests, the flight booking auto-fills destination=London, departure=Aug 4, return=Aug 10, passengers=2. The customer only needs to provide what's actually new (departure city, cabin class). This saves significant time and feels natural.

- **Concise mode**: A toggle that switches the chatbot between asking one question at a time (conversational) and asking for everything in a single numbered list (efficient). This lets the same system serve both casual users who want to be guided and experienced users who want to move fast.

- **Dual-channel**: The same AI agent works on both the web chat and Instagram DMs, with every conversation visible on the operator dashboard regardless of channel.

- **Operator experience**: The admin panel isn't an afterthought. Real-time message mirroring, a pipeline kanban view, per-booking detail pages with editable fields, and the ability to take over any conversation as a human agent.

## What we learned

- **Prompt engineering is software engineering.** The LLM prompts aren't magic strings — they're critical business logic with specific failure modes that need testing and iteration. The difference between a prompt that works 90% of the time and one that works 99% is enormous in production.

- **Structured extraction > free-text generation.** Using JSON schema constraints with the LLM (Gemini's `responseSchema` / Ollama's `format`) eliminates entire categories of bugs compared to parsing free-text output. The extraction outputs are reliable enough to drive a state machine, which is a high bar.

- **The hard part of multi-step AI workflows isn't the AI — it's the state management.** Getting the LLM to understand a message is relatively easy. Knowing *which* LLM call to make, *what context* to pass, *when* to transition states, and *how* to recover from errors — that's the real engineering challenge.

- **Regex is a landmine in user-facing search.** MongoDB's `$regex` operator is convenient but breaks silently on special characters. Any user input that touches a regex query needs sanitization.

## What's next for Operon

- **Real provider API integrations** — connecting to GDS systems (Amadeus, Sabre) for live flight inventory, hotel aggregator APIs (Booking.com, Expedia), and restaurant platforms (OpenTable, Resy) to replace our seed data with real-time availability
- **Persistent chat state** — moving the in-memory conversation store to MongoDB so booking conversations survive server restarts
- **User authentication** — customer accounts with booking history, saved preferences, and loyalty tracking
- **Commission/margin layer** — allowing the travel company to configure their markup on each provider's pricing
- **Analytics dashboard** — conversion funnels, revenue reporting, popular destinations, agent performance metrics
- **Multi-language support** — the LLM can already understand multiple languages, but the UI and system prompts need localization for Southeast Asian markets where our target users operate
