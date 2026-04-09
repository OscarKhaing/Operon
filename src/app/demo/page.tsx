"use client";

import Link from "next/link";
import { ArrowLeft, Plane } from "lucide-react";
import ChatPreview, { ChatPreviewMessage } from "@/components/landing/ChatPreview";

const INTENT_STEPS: ChatPreviewMessage[] = [
  { role: "agent", content: "Hi! I'm Operon. What can I help you book today?" },
  { role: "customer", content: "I need a hotel and a flight to London for August 14–20." },
  { role: "agent", content: "Got it — a hotel and a flight to London. Let me grab a few details." },
];

const EXTRACT_STEPS: ChatPreviewMessage[] = [
  { role: "agent", content: "How many guests, and do you have a nightly budget for the hotel?" },
  { role: "customer", content: "2 people, around $300/night. Center of the city if possible." },
  { role: "agent", content: "Perfect. And for the flight — departing from where, and which cabin class?" },
  { role: "customer", content: "From New York. Economy is fine." },
];

const OPTIONS_STEPS: ChatPreviewMessage[] = [
  { role: "agent", content: "Found 3 hotels in central London matching your dates and budget. Showing options now." },
  { role: "customer", content: "I'll take the second one — The Strand Boutique." },
  { role: "agent", content: "Great pick. Now searching flights JFK → LHR for Aug 14, returning Aug 20…" },
  { role: "agent", content: "Found 4 flights. The cheapest is $612 round-trip on British Airways." },
];

const PAYMENT_STEPS: ChatPreviewMessage[] = [
  { role: "agent", content: "I have everything I need. To finalize, I'll just need your contact info — name, email, phone." },
  { role: "customer", content: "Jane Doe, jane@example.com, 555-0123." },
  { role: "agent", content: "Thanks Jane! Your details will carry over to the flight booking too. Sending you a secure Stripe payment link now." },
  { role: "agent", content: "Payment received. Confirmation emails sent to your inbox and to both providers. You're all set!" },
];

const SECTIONS = [
  {
    label: "01",
    title: "Customer states intent in plain English",
    description: "No forms, no dropdowns. Natural language detects which categories the customer wants to book.",
    script: INTENT_STEPS,
  },
  {
    label: "02",
    title: "AI extracts preferences and asks for missing details",
    description: "Structured extraction pulls dates, budget, guests, departure city — and asks only for what's missing.",
    script: EXTRACT_STEPS,
  },
  {
    label: "03",
    title: "Options are scored and presented as cards",
    description: "Inventory is searched, scored against preferences, and surfaced as ranked, clickable cards. Hotel data cross-populates the flight search.",
    script: OPTIONS_STEPS,
  },
  {
    label: "04",
    title: "Personal info collected once, payment via Stripe",
    description: "Contact info is reused across all bookings in the trip. Stripe processes payment, Resend sends confirmations to the customer and providers.",
    script: PAYMENT_STEPS,
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-[#0a0a0a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#0f172a] rounded-lg flex items-center justify-center">
              <Plane className="w-4 h-4 text-sky-400" />
            </div>
            <span className="text-lg font-extrabold tracking-tight uppercase">Operon</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-700 rounded-full text-xs font-semibold mb-6 border border-sky-100">
            Scripted walkthrough
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5">
            How Operon Books a Trip
          </h1>
          <p className="text-lg text-gray-500 font-medium leading-relaxed">
            A four-step walkthrough of the full booking flow. No live API needed —
            this runs entirely in your browser so you can see the experience even while our AI credits are out.
          </p>
        </div>
      </section>

      {/* Sections */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto space-y-20">
          {SECTIONS.map((section) => (
            <div key={section.label} className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-sky-500 mb-3">
                  Step {section.label}
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-4">
                  {section.title}
                </h2>
                <p className="text-gray-500 text-base leading-relaxed font-medium">
                  {section.description}
                </p>
              </div>
              <div>
                <ChatPreview script={section.script} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold tracking-tight mb-4">Want to try it yourself?</h2>
          <p className="text-gray-500 text-lg mb-8 font-medium">
            The live chat is available in test mode. Note: AI responses depend on Gemini credits being available.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/book"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#0f172a] text-white font-semibold rounded-xl hover:bg-[#1e293b] transition-all shadow-lg shadow-gray-900/10 text-sm"
            >
              Try the Live Chat
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
