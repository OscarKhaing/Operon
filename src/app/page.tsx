"use client";

import Link from "next/link";
import { Plane, MessageSquare, Building2, UtensilsCrossed, ArrowRight, Zap, Globe, Shield, ChevronRight } from "lucide-react";

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
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-4 py-2"
            >
              Admin Panel
            </Link>
            <Link
              href="/book"
              className="text-sm font-semibold text-white bg-[#0f172a] hover:bg-[#1e293b] px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              Try Demo <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
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
            <div className="flex items-center gap-4">
              <Link
                href="/book"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#0f172a] text-white font-semibold rounded-xl hover:bg-[#1e293b] transition-all shadow-lg shadow-gray-900/10 text-sm"
              >
                Start Booking <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-sm"
              >
                View Admin Dashboard
              </Link>
            </div>
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
      <section className="py-16 px-6 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-8">Built with</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {["Next.js 16", "React 19", "TypeScript", "MongoDB", "Google Gemini", "Stripe", "Resend", "Tailwind CSS", "Express.js", "Instagram API"].map((tech) => (
              <span key={tech} className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-medium text-gray-600">
                {tech}
              </span>
            ))}
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
