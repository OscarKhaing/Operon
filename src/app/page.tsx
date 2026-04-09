"use client";

import Link from "next/link";
import { Plane, MessageSquare, Building2, UtensilsCrossed, ArrowRight, Zap, Globe, Shield, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Coins, Code2, BookOpen, PlayCircle } from "lucide-react";
import ChatPreview, { ChatPreviewMessage } from "@/components/landing/ChatPreview";

const HERO_SCRIPT: ChatPreviewMessage[] = [
  { role: "customer", content: "I need a hotel and flight to London for August 14–20." },
  { role: "agent", content: "Got it — 2 guests? Any budget in mind?" },
  { role: "customer", content: "Yes, 2 people, around $300/night." },
  { role: "agent", content: "Found 3 hotels matching your dates. Showing options now." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-[#0a0a0a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Font */}
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#0f172a] rounded-lg flex items-center justify-center">
              <Plane className="w-4 h-4 text-sky-400" />
            </div>
            <span className="text-lg font-extrabold tracking-tight uppercase">Operon</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#how-we-built-it"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("how-we-built-it")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-2 hidden md:block"
            >
              How we built it
            </a>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-2 hidden md:block"
            >
              Admin Panel
            </Link>
            <Link
              href="/book"
              className="text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors hidden sm:flex items-center gap-1.5"
            >
              Live Chat
            </Link>
            <Link
              href="/demo"
              className="text-sm font-semibold text-white bg-[#0f172a] hover:bg-[#1e293b] px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Watch Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-5 gap-12 items-center">
          <div className="md:col-span-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-700 rounded-full text-xs font-semibold mb-6 border border-sky-100">
              <Zap className="w-3 h-3" />
              AI-Powered Booking Operations
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.08] tracking-tight text-[#0a0a0a] mb-6">
              Your entire trip,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600">one conversation.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-500 leading-relaxed mb-10 max-w-xl font-medium">
              Operon is an AI travel agent that books hotels, flights, and restaurants through natural chat. No forms. No friction. Just tell it what you need.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/demo"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#0f172a] text-white font-semibold rounded-xl hover:bg-[#1e293b] transition-all shadow-lg shadow-gray-900/10 text-sm"
              >
                <PlayCircle className="w-4 h-4" />
                Watch the Demo
              </Link>
              <Link
                href="/book"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-sm"
              >
                Try the Live Chat <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="md:col-span-2">
            <ChatPreview script={HERO_SCRIPT} loop />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">How it works</h2>
          <p className="text-3xl md:text-4xl font-extrabold tracking-tight mb-16 max-w-lg">Talk naturally.<br />We handle the rest.</p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Tell us what you need",
                desc: "Say \"I need a hotel, flight, and restaurant in London for August\" — or just one. The AI detects your intent and starts gathering details through conversation.",
                color: "bg-sky-500",
              },
              {
                step: "02",
                title: "Review and select",
                desc: "The AI searches contracted providers, scores options against your preferences, and presents ranked choices as interactive cards. Click to select — no forms needed.",
                color: "bg-blue-600",
              },
              {
                step: "03",
                title: "Pay and confirm",
                desc: "Provide your details once — the AI reuses them across bookings. Pay securely via Stripe. Real confirmation emails are sent to providers automatically.",
                color: "bg-indigo-600",
              },
            ].map((item) => (
              <div key={item.step} className="group">
                <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center text-white text-sm font-bold mb-5`}>
                  {item.step}
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">Multi-category booking</h2>
          <p className="text-3xl md:text-4xl font-extrabold tracking-tight mb-16 max-w-lg">Three industries.<br />One workflow.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Building2,
                label: "Hotels",
                desc: "Search by destination, dates, budget, and room type. Scored by price fit, star rating, and capacity.",
                accent: "sky",
              },
              {
                icon: Plane,
                label: "Flights",
                desc: "Find flights by route, date, cabin class, and budget. Cross-populated from hotel dates and destination.",
                accent: "blue",
              },
              {
                icon: UtensilsCrossed,
                label: "Restaurants",
                desc: "Book by location, cuisine, time, and price range. Party size auto-filled from hotel guests.",
                accent: "indigo",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white border border-gray-200 rounded-2xl p-7 hover:border-gray-300 hover:shadow-lg transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl bg-${item.accent}-50 flex items-center justify-center mb-5`}>
                  <item.icon className={`w-6 h-6 text-${item.accent}-500`} />
                </div>
                <h3 className="text-lg font-bold mb-2">{item.label}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-[#0f172a] text-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400 mb-3">Platform features</h2>
          <p className="text-3xl md:text-4xl font-extrabold tracking-tight mb-16 max-w-lg">Built for travel<br />companies.</p>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: MessageSquare,
                title: "Multi-channel AI Agent",
                desc: "Same AI agent works on web chat and Instagram DMs. Every conversation flows into the operator dashboard.",
              },
              {
                icon: Globe,
                title: "Smart Cross-Population",
                desc: "Book a hotel, and the flight booking auto-fills destination, dates, and passengers. Personal info collected once.",
              },
              {
                icon: Shield,
                title: "Operator Dashboard",
                desc: "Real-time booking pipeline, per-booking detail pages, and the ability to step into any conversation as a human agent.",
              },
              {
                icon: Zap,
                title: "End-to-End Automation",
                desc: "From the first message to Stripe payment to provider confirmation email — fully automated. No manual steps.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white/5 border border-white/10 rounded-2xl p-7 hover:bg-white/10 transition-all duration-300"
              >
                <item.icon className="w-6 h-6 text-sky-400 mb-4" />
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 px-6 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">Built with</h2>
            <p className="text-3xl md:text-4xl font-extrabold tracking-tight">
              A modern, production-grade stack
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                label: "Frontend",
                items: [
                  { name: "Next.js 16", slug: "nextdotjs", color: "000000" },
                  { name: "React 19", slug: "react", color: "61DAFB" },
                  { name: "TypeScript", slug: "typescript", color: "3178C6" },
                  { name: "Tailwind CSS", slug: "tailwindcss", color: "06B6D4" },
                ],
              },
              {
                label: "Backend & Data",
                items: [
                  { name: "Express.js", slug: "express", color: "000000" },
                  { name: "MongoDB", slug: "mongodb", color: "47A248" },
                  { name: "Mongoose", slug: "mongoose", color: "880000" },
                  { name: "Node.js", slug: "nodedotjs", color: "5FA04E" },
                ],
              },
              {
                label: "AI & Integrations",
                items: [
                  { name: "Google Gemini", slug: "googlegemini", color: "8E75B2" },
                  { name: "Stripe", slug: "stripe", color: "635BFF" },
                  { name: "Resend", slug: "resend", color: "000000" },
                  { name: "Instagram API", slug: "instagram", color: "E4405F" },
                ],
              },
            ].map((group) => (
              <div
                key={group.label}
                className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl p-6 hover:border-gray-200 hover:shadow-sm transition-all"
              >
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-5">
                  {group.label}
                </h3>
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <div key={item.name} className="flex items-center gap-3 group">
                      <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center group-hover:border-gray-300 group-hover:shadow-sm transition-all flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://cdn.simpleicons.org/${item.slug}/${item.color}`}
                          alt={item.name}
                          loading="lazy"
                          className="w-5 h-5"
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Project Status — honest disclosure of what works, what's sandbox, what isn't integrated */}
      <section id="how-we-built-it" className="py-20 px-6 bg-[#faf8f3] border-y border-amber-100 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700 mb-3">Project Status</h2>
            <p className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              Built for the hackathon.<br />
              <span className="text-gray-500">Honest about its limits.</span>
            </p>
            <p className="text-gray-500 text-base font-medium leading-relaxed">
              Operon was built in a hackathon with the resources available at the time. Some features are sandbox-only or use seed data instead of real provider APIs. Here&apos;s exactly what&apos;s running.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Card 1: Fully functional */}
            <div className="bg-white border border-emerald-200 rounded-2xl p-7">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-emerald-900">Fully functional</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 leading-relaxed">
                <li>• AI booking conversation flow (extraction, matching, options)</li>
                <li>• Multi-category cross-population (hotel → flight → restaurant)</li>
                <li>• Operator dashboard with real-time chat mirroring</li>
                <li>• Confirmation emails sent via Resend (real inboxes)</li>
                <li>• Trip summary cards</li>
                <li>• MongoDB-backed inventory + bookings</li>
              </ul>
            </div>

            {/* Card 2: Sandbox / Test mode */}
            <div className="bg-white border border-amber-200 rounded-2xl p-7">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-base font-bold text-amber-900">Sandbox / Test mode</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 leading-relaxed">
                <li><span className="font-semibold">Stripe</span> — test API keys; payments are simulated, no real charges</li>
                <li><span className="font-semibold">Instagram DMs</span> — limited to whitelisted tester accounts via Meta Graph API (production access requires app review)</li>
                <li><span className="font-semibold">MongoDB inventory</span> — manually seeded sample data for hotels, flights, restaurants</li>
              </ul>
            </div>

            {/* Card 3: Not integrated */}
            <div className="bg-white border border-rose-200 rounded-2xl p-7">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-rose-600" />
                </div>
                <h3 className="text-base font-bold text-rose-900">Not integrated</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">These require paid business partnerships not available during the hackathon:</p>
              <ul className="space-y-2 text-sm text-gray-600 leading-relaxed">
                <li><span className="font-semibold">Flight inventory</span> — Amadeus, Sabre, Travelport (GDS systems)</li>
                <li><span className="font-semibold">Hotel inventory</span> — Booking.com, Expedia, Hotelbeds (partner APIs)</li>
                <li><span className="font-semibold">Restaurant reservations</span> — OpenTable, Yelp Reservations, Resy</li>
              </ul>
            </div>

            {/* Card 4: AI status */}
            <div className="bg-white border border-violet-200 rounded-2xl p-7">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-violet-600" />
                </div>
                <h3 className="text-base font-bold text-violet-900">AI status</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 leading-relaxed">
                <li>Powered by Google Gemini, currently <span className="font-semibold">out of free-tier credits</span></li>
                <li>Self-hosting Llama 3.2 3B on AWS Free Tier was evaluated and isn&apos;t feasible (the smallest free instance has 1 GB RAM; the model needs ~2 GB even at Q4 quantization)</li>
                <li>The chat will resume working when credits are refilled or a paid tier is purchased</li>
              </ul>
            </div>
          </div>

          {/* Devpost + GitHub buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-12">
            <a
              href="https://devpost.com/software/1240049"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3 bg-[#0f172a] text-white font-semibold rounded-xl hover:bg-[#1e293b] transition-all shadow-md text-sm"
            >
              <BookOpen className="w-4 h-4" />
              How we built it
            </a>
            <a
              href="https://github.com/OscarKhaing/Operon"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-sm"
            >
              <Code2 className="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Ready to see it in action?</h2>
          <p className="text-gray-500 text-lg mb-8 font-medium">Try the AI booking agent yourself. No signup required.</p>
          <Link
            href="/book"
            className="inline-flex items-center gap-2.5 px-8 py-4 bg-[#0f172a] text-white font-semibold rounded-xl hover:bg-[#1e293b] transition-all shadow-lg shadow-gray-900/10"
          >
            Start a Conversation <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Operon</span>
          </div>
          <p className="text-xs text-gray-400">Built with AI for the travel industry</p>
        </div>
      </footer>
    </div>
  );
}
