"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
import { BookingRequest, ChatMessage, HotelOptionCard, FlightOptionCard, RestaurantOptionCard } from "@/lib/types";
import { cn, formatDateTime, statusLabel } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  Send,
  Plus,
  MessageSquare,
  Bot,
  User,
  Info,
  Cpu,
  Loader2,
  CheckCircle2,
  XCircle,
  Star,
  Check,
} from "lucide-react";

export default function ChatPage() {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [conciseMode, setConciseMode] = useState(false);
  const [llmStatus, setLlmStatus] = useState<{ ok: boolean; model: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check LLM status on mount
  useEffect(() => {
    fetch("/api/llm")
      .then((r) => r.json())
      .then(setLlmStatus)
      .catch(() => setLlmStatus({ ok: false, model: "unknown" }));
  }, []);

  // Load bookings
  const refreshBookings = useCallback(async () => {
    const res = await fetch("/api/bookings");
    const data: BookingRequest[] = await res.json();
    setBookings(data);
    return data;
  }, []);

  useEffect(() => {
    refreshBookings().then((data) => {
      if (data.length > 0 && !activeBookingId) {
        setActiveBookingId(data[data.length - 1].id);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Are options still selectable? Only if booking is in options_presented state.
  // Sync concise mode to booking
  useEffect(() => {
    if (!activeBookingId) return;
    fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeBookingId, conciseMode }),
    }).catch(() => {});
  }, [conciseMode, activeBookingId]);

  const optionsSelectable = activeBooking?.status === "options_presented" && !sending;

  async function handleSend(
    content: string,
    metadata?: { type: "option_selected"; optionIndex: number; optionId: string },
  ) {
    if (!content.trim() || !activeBookingId || sending) return;

    setInput("");
    setSending(true);

    const role = agentMode ? "agent" : "customer";

    // Optimistic update
    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      bookingId: activeBookingId,
      role,
      content: content.trim(),
      timestamp: new Date().toISOString(),
      metadata: metadata ?? undefined,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: activeBookingId,
          content: content.trim(),
          metadata: metadata ?? undefined,
          ...(agentMode ? { role: "agent" } : {}),
        }),
      });

      // Reload messages to get all server-side messages (system + agent)
      const msgRes = await fetch(`/api/chat?bookingId=${activeBookingId}`);
      setMessages(await msgRes.json());

      // Reload bookings to update status
      await refreshBookings();
    } catch {
      // On error, keep the optimistic message
    } finally {
      setSending(false);
    }
  }

  function handleTextSend() {
    handleSend(input);
  }

  function handleOptionSelect(option: HotelOptionCard | FlightOptionCard | RestaurantOptionCard, index: number) {
    if (!optionsSelectable) return;
    const label =
      "hotelName" in option ? `${option.hotelName} - ${option.roomType}` :
      "airline" in option ? `${option.airline} ${option.flightNumber}` :
      (option as RestaurantOptionCard).restaurantName;
    handleSend(
      `I'll take option ${index + 1}: ${label}`,
      { type: "option_selected", optionIndex: index, optionId: option.optionId },
    );
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
  }

  // Workflow stage display
  const workflowStage = activeBooking
    ? WORKFLOW_STAGES[activeBooking.status] || { label: statusLabel(activeBooking.status), description: "" }
    : null;

  return (
    <div className="h-screen flex flex-col">
      <Header title="Chat" />

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <button
              onClick={handleNewBooking}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Booking
            </button>

            {/* LLM Status */}
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
              <Cpu className="w-3 h-3 text-gray-400" />
              {llmStatus === null ? (
                <span className="text-gray-400">Checking LLM...</span>
              ) : llmStatus.ok ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600">{llmStatus.model}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 text-red-400" />
                  <span className="text-red-500">LLM offline</span>
                </>
              )}
            </div>
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
              {/* Chat header with workflow stage */}
              <div className="bg-white border-b border-gray-200 px-6 py-3">
                <div className="flex items-center justify-between">
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
                {workflowStage && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <WorkflowProgress status={activeBooking.status} />
                    <span className="text-gray-500">{workflowStage.description}</span>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onSelectOption={handleOptionSelect}
                    optionsSelectable={optionsSelectable}
                  />
                ))}

                {/* Typing indicator */}
                {sending && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="bg-white text-gray-400 border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 text-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="bg-white border-t border-gray-200 px-6 py-3">
                {/* Agent mode toggle */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setAgentMode(false)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      !agentMode ? "bg-sky-100 text-sky-700" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> AI Agent</span>
                  </button>
                  <button
                    onClick={() => setAgentMode(true)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      agentMode ? "bg-violet-100 text-violet-700" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> Agent Mode</span>
                  </button>
                  {agentMode && (
                    <span className="text-[10px] text-violet-500 ml-1">Typing as agent — bypasses AI</span>
                  )}
                  <div className="ml-auto">
                    <button
                      onClick={() => setConciseMode(!conciseMode)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                        conciseMode ? "bg-sky-100 text-sky-700" : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      {conciseMode ? "Concise" : "Standard"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleTextSend()}
                    placeholder={
                      agentMode
                        ? "Type as agent (bypasses AI)..."
                        : activeBooking.status === "cancelled"
                          ? "Booking cancelled"
                          : activeBooking.status === "options_presented"
                            ? "Click an option above, or type your preference..."
                            : "Type customer message..."
                    }
                    className={cn(
                      "flex-1 px-4 py-2.5 bg-gray-50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent",
                      agentMode
                        ? "border-violet-300 focus:ring-violet-500"
                        : "border-gray-200 focus:ring-sky-500"
                    )}
                    disabled={sending || (!agentMode && activeBooking.status === "cancelled")}
                  />
                  <button
                    onClick={handleTextSend}
                    disabled={!input.trim() || sending || (!agentMode && activeBooking.status === "cancelled")}
                    className={cn(
                      "px-4 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2",
                      agentMode
                        ? "bg-violet-500 hover:bg-violet-600"
                        : "bg-sky-500 hover:bg-sky-600"
                    )}
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
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
              {activeBooking.category && (
                <div className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-600 inline-block capitalize">
                  {activeBooking.category}
                </div>
              )}
              <DetailRow label="Name" value={activeBooking.customer.name} />
              <DetailRow label="Email" value={activeBooking.customer.email} />
              <DetailRow label="Phone" value={activeBooking.customer.phone} />

              {(!activeBooking.category || activeBooking.category === "hotel") && (
                <>
                  <DetailRow label="Passport" value={activeBooking.customer.passport} />
                  <DetailRow label="Nationality" value={activeBooking.customer.nationality} />
                  <hr className="border-gray-100" />
                  <DetailRow label="Destination" value={activeBooking.travel.destination} />
                  <DetailRow label="Check-in" value={activeBooking.travel.checkIn} />
                  <DetailRow label="Check-out" value={activeBooking.travel.checkOut} />
                  <DetailRow label="Guests" value={String(activeBooking.travel.guestCount || "")} />
                  <hr className="border-gray-100" />
                  <DetailRow label="Room Type" value={activeBooking.preferences.roomType} />
                  <DetailRow label="Budget" value={activeBooking.preferences.maxBudgetPerNight ? `$${activeBooking.preferences.maxBudgetPerNight}/night` : ""} />
                </>
              )}

              {activeBooking.category === "flight" && activeBooking.flightDetails && (
                <>
                  <DetailRow label="Passport" value={activeBooking.customer.passport} />
                  <DetailRow label="Nationality" value={activeBooking.customer.nationality} />
                  <hr className="border-gray-100" />
                  <DetailRow label="Origin" value={activeBooking.flightDetails.origin} />
                  <DetailRow label="Destination" value={activeBooking.flightDetails.destination} />
                  <DetailRow label="Departure" value={activeBooking.flightDetails.departureDate} />
                  <DetailRow label="Return" value={activeBooking.flightDetails.returnDate} />
                  <DetailRow label="Passengers" value={String(activeBooking.flightDetails.passengers || "")} />
                  <DetailRow label="Cabin Class" value={activeBooking.flightDetails.cabinClass} />
                  <DetailRow label="Budget" value={activeBooking.flightDetails.maxBudget ? `$${activeBooking.flightDetails.maxBudget}` : ""} />
                </>
              )}

              {activeBooking.category === "restaurant" && activeBooking.restaurantDetails && (
                <>
                  <hr className="border-gray-100" />
                  <DetailRow label="Location" value={activeBooking.restaurantDetails.location} />
                  <DetailRow label="Date" value={activeBooking.restaurantDetails.date} />
                  <DetailRow label="Time" value={activeBooking.restaurantDetails.time} />
                  <DetailRow label="Party Size" value={String(activeBooking.restaurantDetails.partySize || "")} />
                  <DetailRow label="Cuisine" value={activeBooking.restaurantDetails.cuisine} />
                  <DetailRow label="Price Range" value={activeBooking.restaurantDetails.priceRange ? `$${activeBooking.restaurantDetails.priceRange}/person` : ""} />
                </>
              )}

              <DetailRow label="Special Requests" value={activeBooking.preferences.specialRequests} />

              {["collecting_info", "filling_template", "sent_to_hotel", "confirmed"].includes(activeBooking.status) && (
                <>
                  <hr className="border-gray-100" />
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Personal Info Checklist
                  </h4>
                  <ChecklistItem label="Full Name" value={activeBooking.customer.name} />
                  {activeBooking.category !== "restaurant" && (
                    <>
                      <ChecklistItem label="Passport" value={activeBooking.customer.passport} />
                      <ChecklistItem label="Nationality" value={activeBooking.customer.nationality} />
                    </>
                  )}
                  <ChecklistItem label="Email" value={activeBooking.customer.email} />
                  <ChecklistItem label="Phone" value={activeBooking.customer.phone} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Workflow stages config ─────────────────────────────────────────────────

const WORKFLOW_STAGES: Record<string, { label: string; description: string; step: number }> = {
  intake: { label: "Intake", description: "Waiting for customer to describe their needs", step: 1 },
  extracting: { label: "Collecting Preferences", description: "Gathering destination, dates, budget...", step: 2 },
  matching: { label: "Searching", description: "Finding matching hotels...", step: 3 },
  options_presented: { label: "Options Sent", description: "Waiting for customer to select an option", step: 4 },
  selected: { label: "Selected", description: "Customer chose a hotel", step: 5 },
  collecting_info: { label: "Info Collection", description: "Gathering passport, name, contact details...", step: 5 },
  filling_template: { label: "Processing", description: "Generating reservation document...", step: 6 },
  sent_to_hotel: { label: "Sent", description: "Reservation sent, awaiting hotel confirmation", step: 7 },
  confirmed: { label: "Confirmed", description: "Booking confirmed by hotel!", step: 8 },
};

const TOTAL_STEPS = 8;

function WorkflowProgress({ status }: { status: string }) {
  const stage = WORKFLOW_STAGES[status];
  if (!stage) return null;
  const pct = Math.round((stage.step / TOTAL_STEPS) * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-sky-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-gray-500 font-medium">{stage.label}</span>
    </div>
  );
}

// ─── Hotel Option Card ──────────────────────────────────────────────────────

type AnyOptionCard = HotelOptionCard | FlightOptionCard | RestaurantOptionCard;

function OptionCard({
  option,
  index,
  onSelect,
  selectable,
}: {
  option: AnyOptionCard;
  index: number;
  onSelect: (option: AnyOptionCard, index: number) => void;
  selectable: boolean;
}) {
  // Dispatch to type-specific card
  if ("airline" in option) return <FlightCard option={option} index={index} onSelect={onSelect} selectable={selectable} />;
  if ("restaurantName" in option) return <RestaurantCard option={option} index={index} onSelect={onSelect} selectable={selectable} />;
  return <HotelCard option={option} index={index} onSelect={onSelect} selectable={selectable} />;
}

function HotelCard({
  option,
  index,
  onSelect,
  selectable,
}: {
  option: HotelOptionCard;
  index: number;
  onSelect: (option: AnyOptionCard, index: number) => void;
  selectable: boolean;
}) {
  const isTopPick = index === 0;

  return (
    <button
      onClick={() => selectable && onSelect(option, index)}
      disabled={!selectable}
      className={cn(
        "w-full text-left rounded-xl border-2 p-4 transition-all duration-200",
        selectable
          ? "cursor-pointer hover:border-sky-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          : "cursor-default opacity-75",
        isTopPick && selectable
          ? "border-sky-300 bg-sky-50/50"
          : "border-gray-200 bg-white",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
            isTopPick ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-600"
          )}>
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{option.hotelName}</p>
            <p className="text-xs text-gray-500">{option.roomType}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-bold text-gray-900">${option.pricePerNight}<span className="text-xs font-normal text-gray-400">/night</span></p>
          <p className="text-xs text-gray-500">${option.totalPrice} total · {option.nights}n</p>
        </div>
      </div>

      {/* Stars + Score */}
      <div className="flex items-center gap-3 mt-2.5">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: option.stars }).map((_, i) => (
            <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
          ))}
        </div>
        <span className={cn(
          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
          option.score >= 80 ? "bg-emerald-100 text-emerald-700" :
          option.score >= 60 ? "bg-amber-100 text-amber-700" :
          "bg-gray-100 text-gray-600"
        )}>
          {option.score}% match
        </span>
        {isTopPick && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">
            Best Match
          </span>
        )}
      </div>

      {/* Amenities */}
      <div className="flex flex-wrap gap-1 mt-2.5">
        {option.amenities.slice(0, 5).map((a) => (
          <span key={a} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
            {a}
          </span>
        ))}
        {option.amenities.length > 5 && (
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">
            +{option.amenities.length - 5} more
          </span>
        )}
      </div>

      {/* Select button */}
      {selectable && (
        <div className={cn(
          "mt-3 py-2 rounded-lg text-xs font-semibold text-center transition-colors",
          isTopPick
            ? "bg-sky-500 text-white"
            : "bg-gray-100 text-gray-700 group-hover:bg-sky-500 group-hover:text-white"
        )}>
          <span className="flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            Select This Option
          </span>
        </div>
      )}
    </button>
  );
}

function FlightCard({
  option,
  index,
  onSelect,
  selectable,
}: {
  option: FlightOptionCard;
  index: number;
  onSelect: (option: AnyOptionCard, index: number) => void;
  selectable: boolean;
}) {
  const isTopPick = index === 0;
  return (
    <button
      onClick={() => selectable && onSelect(option, index)}
      disabled={!selectable}
      className={cn(
        "w-full text-left rounded-xl border-2 p-4 transition-all duration-200",
        selectable ? "cursor-pointer hover:border-sky-400 hover:shadow-md hover:-translate-y-0.5" : "cursor-default opacity-75",
        isTopPick && selectable ? "border-sky-300 bg-sky-50/50" : "border-gray-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0", isTopPick ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-600")}>{index + 1}</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{option.airline} {option.flightNumber}</p>
            <p className="text-xs text-gray-500">{option.origin} → {option.destination}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-bold text-gray-900">${option.price}<span className="text-xs font-normal text-gray-400">/person</span></p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2.5">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{option.cabinClass}</span>
        <span className="text-[10px] text-gray-500">Departs: {option.departureDate}</span>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", option.score >= 80 ? "bg-emerald-100 text-emerald-700" : option.score >= 60 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600")}>{option.score}% match</span>
        {isTopPick && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">Best Match</span>}
      </div>
      {selectable && (
        <div className={cn("mt-3 py-2 rounded-lg text-xs font-semibold text-center transition-colors", isTopPick ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-700")}>
          <span className="flex items-center justify-center gap-1.5"><Check className="w-3.5 h-3.5" />Select This Flight</span>
        </div>
      )}
    </button>
  );
}

function RestaurantCard({
  option,
  index,
  onSelect,
  selectable,
}: {
  option: RestaurantOptionCard;
  index: number;
  onSelect: (option: AnyOptionCard, index: number) => void;
  selectable: boolean;
}) {
  const isTopPick = index === 0;
  return (
    <button
      onClick={() => selectable && onSelect(option, index)}
      disabled={!selectable}
      className={cn(
        "w-full text-left rounded-xl border-2 p-4 transition-all duration-200",
        selectable ? "cursor-pointer hover:border-sky-400 hover:shadow-md hover:-translate-y-0.5" : "cursor-default opacity-75",
        isTopPick && selectable ? "border-sky-300 bg-sky-50/50" : "border-gray-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0", isTopPick ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-600")}>{index + 1}</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{option.restaurantName}</p>
            <p className="text-xs text-gray-500">{option.cuisine} · {option.location}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-bold text-gray-900">${option.priceRange}<span className="text-xs font-normal text-gray-400">/person</span></p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2.5">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: Math.round(option.rating) }).map((_, i) => (
            <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
          ))}
        </div>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", option.score >= 80 ? "bg-emerald-100 text-emerald-700" : option.score >= 60 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600")}>{option.score}% match</span>
        {isTopPick && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">Best Match</span>}
      </div>
      <div className="flex flex-wrap gap-1 mt-2.5">
        {option.amenities.slice(0, 5).map((a) => (
          <span key={a} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{a}</span>
        ))}
        {option.amenities.length > 5 && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">+{option.amenities.length - 5} more</span>}
      </div>
      {selectable && (
        <div className={cn("mt-3 py-2 rounded-lg text-xs font-semibold text-center transition-colors", isTopPick ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-700")}>
          <span className="flex items-center justify-center gap-1.5"><Check className="w-3.5 h-3.5" />Select This Restaurant</span>
        </div>
      )}
    </button>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onSelectOption,
  optionsSelectable,
}: {
  message: ChatMessage;
  onSelectOption: (option: AnyOptionCard, index: number) => void;
  optionsSelectable: boolean;
}) {
  if (message.role === "system") {
    // Provider response styling
    if (message.metadata?.type === "hotel_response" || message.metadata?.type === "provider_response") {
      const resp = message.metadata;
      const styles = {
        confirmed: "bg-emerald-50 border-emerald-200 text-emerald-700",
        more_info_needed: "bg-amber-50 border-amber-200 text-amber-700",
        no_availability: "bg-red-50 border-red-200 text-red-700",
      };
      const icons = {
        confirmed: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        more_info_needed: <Info className="w-4 h-4 text-amber-500" />,
        no_availability: <XCircle className="w-4 h-4 text-red-500" />,
      };
      return (
        <div className="flex justify-center">
          <div className={cn("border rounded-lg px-4 py-2.5 text-xs max-w-md flex items-center gap-2", styles[resp.responseType])}>
            {icons[resp.responseType]}
            <span>{message.content}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-center">
        <div className="bg-gray-100 text-gray-500 text-xs px-3 py-1.5 rounded-full max-w-md text-center">
          {message.content}
        </div>
      </div>
    );
  }

  const isCustomer = message.role === "customer";
  const hasOptionCards = !isCustomer && (message.metadata?.type === "hotel_options" || message.metadata?.type === "flight_options" || message.metadata?.type === "restaurant_options");

  // Customer selection message — show as a compact confirmation
  if (isCustomer && message.metadata?.type === "option_selected") {
    return (
      <div className="flex gap-3 justify-end">
        <div className="bg-sky-500 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{message.content}</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-sky-600" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isCustomer ? "justify-end" : "justify-start")}>
      {!isCustomer && (
        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-4 h-4 text-violet-600" />
        </div>
      )}
      <div className={cn("flex flex-col gap-3", isCustomer ? "items-end" : "items-start", hasOptionCards ? "max-w-lg" : "max-w-md")}>
        {/* Text content — always shown (even with cards, as intro text) */}
        {message.content && !hasOptionCards && (
          <div
            className={cn(
              "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
              isCustomer
                ? "bg-sky-500 text-white rounded-br-md"
                : "bg-white text-gray-800 border border-gray-200 rounded-bl-md"
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            <p className={cn("text-[10px] mt-1.5", isCustomer ? "text-sky-200" : "text-gray-400")}>
              {formatDateTime(message.timestamp)}
            </p>
          </div>
        )}

        {/* Option cards — rendered when metadata has any option type */}
        {hasOptionCards && (message.metadata?.type === "hotel_options" || message.metadata?.type === "flight_options" || message.metadata?.type === "restaurant_options") && (
          <div className="w-full space-y-3">
            <div className="bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
              <p>Here are the best options I found for you. {optionsSelectable ? "Click one to select it:" : ""}</p>
              <p className={cn("text-[10px] mt-1.5 text-gray-400")}>{formatDateTime(message.timestamp)}</p>
            </div>
            {message.metadata.options.map((opt: AnyOptionCard, i: number) => (
              <OptionCard key={opt.optionId} option={opt} index={i} onSelect={onSelectOption} selectable={optionsSelectable} />
            ))}
          </div>
        )}
      </div>
      {isCustomer && (
        <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-sky-600" />
        </div>
      )}
    </div>
  );
}

// ─── Small components ───────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-gray-800 font-medium">{value || "—"}</p>
    </div>
  );
}

function ChecklistItem({ label, value }: { label: string; value: string }) {
  const filled = Boolean(value);
  return (
    <div className="flex items-center gap-2">
      {filled ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
      )}
      <span className={cn("text-xs", filled ? "text-gray-800" : "text-gray-400")}>
        {label}: {filled ? value : "missing"}
      </span>
    </div>
  );
}
