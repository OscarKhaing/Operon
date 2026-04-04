"use client";

import { useEffect, useState, useRef } from "react";
import Header from "@/components/layout/Header";
import { BookingRequest, ChatMessage } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  Send,
  Plus,
  MessageSquare,
  Bot,
  User,
  Info,
} from "lucide-react";

export default function ChatPage() {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load bookings
  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data: BookingRequest[]) => {
        setBookings(data);
        if (data.length > 0 && !activeBookingId) {
          setActiveBookingId(data[data.length - 1].id);
        }
      });
  }, [activeBookingId]);

  // Load messages when booking changes
  useEffect(() => {
    if (!activeBookingId) return;
    fetch(`/api/chat?bookingId=${activeBookingId}`)
      .then((r) => r.json())
      .then(setMessages);
  }, [activeBookingId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeBooking = bookings.find((b) => b.id === activeBookingId);

  async function handleSend() {
    if (!input.trim() || !activeBookingId || sending) return;

    const content = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update
    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      bookingId: activeBookingId,
      role: "customer",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: activeBookingId, content }),
      });
      const data = await res.json();

      // Reload messages to get server-side messages including system
      const msgRes = await fetch(`/api/chat?bookingId=${activeBookingId}`);
      const allMsgs = await msgRes.json();
      setMessages(allMsgs);

      // Reload bookings to update status
      const bkRes = await fetch("/api/bookings");
      setBookings(await bkRes.json());
    } catch {
      // On error, keep the optimistic message
    } finally {
      setSending(false);
    }
  }

  async function handleNewBooking() {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedTo: "Alice" }),
    });
    const newBooking = await res.json();
    setBookings((prev) => [...prev, newBooking]);
    setActiveBookingId(newBooking.id);
    setMessages([]);

    // Add welcome message
    const welcomeRes = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: newBooking.id,
        content: "Hi, I need to book a hotel.",
      }),
    });

    const msgRes = await fetch(`/api/chat?bookingId=${newBooking.id}`);
    setMessages(await msgRes.json());
  }

  return (
    <div className="h-screen flex flex-col">
      <Header title="Chat" />

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <button
              onClick={handleNewBooking}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Booking
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {bookings.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveBookingId(b.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-gray-50 transition-colors",
                  b.id === activeBookingId
                    ? "bg-sky-50 border-l-2 border-l-sky-500"
                    : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {b.customer.name || "New Customer"}
                  </span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {b.travel.destination || "No destination yet"}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {activeBooking ? (
            <>
              {/* Chat header */}
              <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {activeBooking.customer.name || "New Customer"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activeBooking.travel.destination || "Pending destination"} · {activeBooking.id}
                    </p>
                  </div>
                </div>
                <StatusBadge status={activeBooking.status} />
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="bg-white border-t border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Type customer message..."
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    disabled={sending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="px-4 py-2.5 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a conversation or start a new booking</p>
              </div>
            </div>
          )}
        </div>

        {/* Info panel */}
        {activeBooking && (
          <div className="w-72 bg-white border-l border-gray-200 p-5 overflow-y-auto">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info className="w-3.5 h-3.5" />
              Booking Details
            </h3>
            <div className="space-y-4 text-sm">
              <DetailRow label="Name" value={activeBooking.customer.name} />
              <DetailRow label="Passport" value={activeBooking.customer.passport} />
              <DetailRow label="Email" value={activeBooking.customer.email} />
              <DetailRow label="Phone" value={activeBooking.customer.phone} />
              <hr className="border-gray-100" />
              <DetailRow label="Destination" value={activeBooking.travel.destination} />
              <DetailRow label="Check-in" value={activeBooking.travel.checkIn} />
              <DetailRow label="Check-out" value={activeBooking.travel.checkOut} />
              <DetailRow label="Guests" value={String(activeBooking.travel.guestCount || "")} />
              <hr className="border-gray-100" />
              <DetailRow label="Room Type" value={activeBooking.preferences.roomType} />
              <DetailRow
                label="Budget"
                value={activeBooking.preferences.maxBudgetPerNight ? `$${activeBooking.preferences.maxBudgetPerNight}/night` : ""}
              />
              <DetailRow label="Special Requests" value={activeBooking.preferences.specialRequests} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <div className="bg-gray-100 text-gray-500 text-xs px-3 py-1.5 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  const isCustomer = message.role === "customer";

  return (
    <div className={cn("flex gap-3", isCustomer ? "justify-end" : "justify-start")}>
      {!isCustomer && (
        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-violet-600" />
        </div>
      )}
      <div
        className={cn(
          "max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
          isCustomer
            ? "bg-sky-500 text-white rounded-br-md"
            : "bg-white text-gray-800 border border-gray-200 rounded-bl-md"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            "text-[10px] mt-1.5",
            isCustomer ? "text-sky-200" : "text-gray-400"
          )}
        >
          {formatDateTime(message.timestamp)}
        </p>
      </div>
      {isCustomer && (
        <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-sky-600" />
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-gray-800 font-medium">{value || "—"}</p>
    </div>
  );
}
