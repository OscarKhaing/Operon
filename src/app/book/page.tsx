"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { BookingRequest, ChatMessage, HotelOptionCard } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import {
  Send,
  Bot,
  User,
  Loader2,
  CheckCircle2,
  XCircle,
  Star,
  Check,
  MessageSquare,
  Info
} from "lucide-react";
import Header from "@/components/layout/Header";

// Note: Duplicating OptionCard and MessageBubble to keep the user chat fully independent
// from the operator chat.

export default function CustomerChatPage() {
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<BookingRequest | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize booking
  useEffect(() => {
    const initBooking = async () => {
      const savedId = localStorage.getItem("customerBookingId");
      if (savedId) {
        // Verify it still exists
        try {
          const res = await fetch("/api/bookings");
          const bookings: BookingRequest[] = await res.json();
          const found = bookings.find((b) => b.id === savedId);
          if (found) {
            setActiveBookingId(savedId);
            setActiveBooking(found);
            return;
          }
        } catch (e) {
          console.error("Failed to load existing bookings", e);
        }
      }

      // Create new booking
      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignedTo: "AI Agent" }),
        });
        const newBooking = await res.json();
        setActiveBookingId(newBooking.id);
        setActiveBooking(newBooking);
        localStorage.setItem("customerBookingId", newBooking.id);
      } catch (e) {
        console.error("Failed to create new booking", e);
      }
    };

    initBooking();
  }, []);

  // Poll for messages and booking status
  const refreshState = useCallback(async () => {
    if (!activeBookingId) return;
    
    try {
      // Reload messages
      const msgRes = await fetch(`/api/chat?bookingId=${activeBookingId}`);
      if (msgRes.ok) {
        const fetchedMessages = await msgRes.json();
        setMessages(fetchedMessages);
      }
      
      // Reload booking to get current status
      const bkgRes = await fetch("/api/bookings");
      if (bkgRes.ok) {
        const bookings: BookingRequest[] = await bkgRes.json();
        const found = bookings.find((b) => b.id === activeBookingId);
        if (found) setActiveBooking(found);
      }
    } catch (e) {
      console.error("Failed to refresh state", e);
    }
  }, [activeBookingId]);

  useEffect(() => {
    if (!activeBookingId) return;
    refreshState();
    
    // Poll every few seconds to receive background agent/system messages (e.g. hotel confirmations)
    const interval = setInterval(refreshState, 3000);
    return () => clearInterval(interval);
  }, [activeBookingId, refreshState]);

  // Auto-scroll to bottom only when already near the bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const threshold = 150; // px from bottom
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const optionsSelectable = activeBooking?.status === "options_presented" && !sending;

  async function handleSend(
    content: string,
    metadata?: { type: "option_selected"; optionIndex: number; optionId: string },
  ) {
    if (!content.trim() || !activeBookingId || sending) return;

    setInput("");
    setSending(true);

    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      bookingId: activeBookingId,
      role: "customer",
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
          role: "customer",
        }),
      });

      await refreshState();
    } catch (e) {
      console.error("Failed to send message", e);
    } finally {
      setSending(false);
    }
  }

  function handleTextSend() {
    handleSend(input);
  }

  function handleOptionSelect(option: HotelOptionCard, index: number) {
    if (!optionsSelectable) return;
    handleSend(
      `I'll take option ${index + 1}: ${option.hotelName} - ${option.roomType}`,
      { type: "option_selected", optionIndex: index, optionId: option.optionId },
    );
  }

  function handleRestart() {
    localStorage.removeItem("customerBookingId");
    window.location.reload();
  }

  if (!activeBookingId || !activeBooking) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Initializing your chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center shadow-inner">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">Operon Booking Agent</h1>
            <p className="text-xs text-green-500 font-medium flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Online 
            </p>
          </div>
        </div>
        <button
          onClick={handleRestart}
          className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-full px-3 py-1.5 transition-colors"
        >
          Start New Chat
        </button>
      </header>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full overflow-hidden px-4 md:px-0">
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {messages.length === 0 && !sending && (
             <div className="flex justify-center my-10">
               <div className="bg-sky-50 text-sky-800 text-sm px-6 py-4 rounded-xl text-center shadow-sm border border-sky-100 max-w-md">
                 <p className="font-semibold mb-1">Welcome to Operon!</p>
                 <p>I'm your personal booking agent. Let me know where you want to go, your dates, and your budget, and I'll find you the perfect hotel.</p>
               </div>
             </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onSelectOption={handleOptionSelect}
              optionsSelectable={optionsSelectable}
            />
          ))}

          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 border border-sky-200">
                <Bot className="w-5 h-5 text-sky-600" />
              </div>
              <div className="bg-white text-gray-500 border border-gray-200 shadow-sm rounded-2xl rounded-tl-sm px-5 py-3 text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                Thinking...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4 md:p-6 pb-6 md:pb-8">
          <div className="relative flex items-end gap-3 max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTextSend();
                }
              }}
              placeholder={
                activeBooking.status === "confirmed"
                  ? "Booking confirmed!"
                  : activeBooking.status === "cancelled"
                    ? "Booking cancelled"
                    : activeBooking.status === "options_presented"
                      ? "Click an option above, or type your preference..."
                      : "Type your message..."
              }
              rows={input.split('\n').length > 1 || input.length > 50 ? 3 : 1}
              className={cn(
                "flex-1 px-5 py-3.5 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 resize-none transition-all",
                "shadow-sm border-gray-200"
              )}
              disabled={sending || ["confirmed", "cancelled"].includes(activeBooking.status)}
            />
            <button
              onClick={handleTextSend}
              disabled={!input.trim() || sending || ["confirmed", "cancelled"].includes(activeBooking.status)}
              className={cn(
                "h-12 w-12 rounded-full text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0 shadow-md",
                "bg-sky-500 hover:bg-sky-600 hover:shadow-lg active:scale-95"
              )}
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5 -ml-0.5" />
              )}
            </button>
          </div>
          <div className="text-center mt-3">
             <span className="text-[10px] text-gray-400">Operon AI Agent can make mistakes. Check important details.</span>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Option Card Component ──────────────────────────────────────────────────

function OptionCard({
  option,
  index,
  onSelect,
  selectable,
}: {
  option: HotelOptionCard;
  index: number;
  onSelect: (option: HotelOptionCard, index: number) => void;
  selectable: boolean;
}) {
  const isTopPick = index === 0;

  return (
    <button
      onClick={() => selectable && onSelect(option, index)}
      disabled={!selectable}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all duration-200 mb-3 block shadow-sm",
        selectable
          ? "cursor-pointer hover:border-sky-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          : "cursor-default opacity-80",
        isTopPick && selectable
          ? "border-sky-200 bg-sky-50/30"
          : "border-gray-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm",
            isTopPick ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-700"
          )}>
            {index + 1}
          </span>
          <div>
            <p className="text-base font-semibold text-gray-900">{option.hotelName}</p>
            <p className="text-sm text-gray-500">{option.roomType}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-sky-700">${option.pricePerNight}<span className="text-xs font-normal text-gray-500">/night</span></p>
          <p className="text-xs text-gray-500">${option.totalPrice} total · {option.nights} nights</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: option.stars }).map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          ))}
        </div>
        <span className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-full",
          option.score >= 80 ? "bg-emerald-100 text-emerald-700" :
          option.score >= 60 ? "bg-amber-100 text-amber-700" :
          "bg-gray-100 text-gray-600"
        )}>
          {option.score}% match
        </span>
        {isTopPick && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
            Top Pick
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {option.amenities.slice(0, 5).map((a) => (
          <span key={a} className="text-[10px] uppercase tracking-wider font-medium px-2 py-1 bg-gray-100 text-gray-500 rounded-md">
            {a}
          </span>
        ))}
        {option.amenities.length > 5 && (
          <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-1 bg-gray-100 text-gray-400 rounded-md">
            +{option.amenities.length - 5}
          </span>
        )}
      </div>

      {selectable && (
        <div className={cn(
          "mt-4 py-2.5 rounded-lg text-sm font-semibold text-center transition-colors shadow-sm",
          isTopPick
            ? "bg-sky-500 text-white hover:bg-sky-600"
            : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700"
        )}>
          <span className="flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            Book This Option
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Message Bubble Component ───────────────────────────────────────────────

function MessageBubble({
  message,
  onSelectOption,
  optionsSelectable,
}: {
  message: ChatMessage;
  onSelectOption: (option: HotelOptionCard, index: number) => void;
  optionsSelectable: boolean;
}) {
  if (message.role === "system") {
    if (message.metadata?.type === "hotel_response") {
      const resp = message.metadata;
      const styles = {
        confirmed: "bg-emerald-50 border-emerald-200 text-emerald-800",
        more_info_needed: "bg-amber-50 border-amber-200 text-amber-800",
        no_availability: "bg-red-50 border-red-200 text-red-800",
      };
      const icons = {
        confirmed: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        more_info_needed: <Info className="w-4 h-4 text-amber-600" />,
        no_availability: <XCircle className="w-4 h-4 text-red-600" />,
      };
      return (
        <div className="flex justify-center my-4">
          <div className={cn("border rounded-xl px-5 py-3 text-sm flex items-center gap-3 shadow-sm max-w-md", styles[resp.responseType])}>
            {icons[resp.responseType]}
            <span className="font-medium">{message.content}</span>
          </div>
        </div>
      );
    }
    // Optionally hide regular purely internal system logs from customer
    // For demo purposes, we might just style them softly
    return (
      <div className="flex justify-center my-2">
        <div className="border border-gray-100 bg-gray-50 text-gray-400 text-[11px] px-4 py-1.5 rounded-full max-w-md text-center">
          system: {message.content}
        </div>
      </div>
    );
  }

  const isCustomer = message.role === "customer";
  const hasOptionCards = !isCustomer && message.metadata?.type === "hotel_options";

  if (isCustomer && message.metadata?.type === "option_selected") {
    return (
      <div className="flex gap-3 justify-end my-2">
        <div className="bg-sky-500 text-white rounded-2xl rounded-tr-sm px-5 py-3 text-sm flex items-center gap-2 shadow-sm">
          <Check className="w-4 h-4 text-sky-100" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isCustomer ? "justify-end" : "justify-start")}>
      {!isCustomer && (
        <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 mt-auto mb-1 border border-sky-200">
          <Bot className="w-5 h-5 text-sky-600" />
        </div>
      )}
      
      <div className={cn("flex flex-col gap-2", isCustomer ? "items-end" : "items-start", hasOptionCards ? "w-full max-w-md lg:max-w-xl" : "max-w-[85%] md:max-w-[75%]")}>
        {message.content && !hasOptionCards && (
          <div
            className={cn(
              "px-5 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm block w-fit",
              isCustomer
                ? "bg-sky-500 text-white rounded-tr-sm"
                : "bg-white text-gray-800 border border-gray-100 rounded-tl-sm"
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            <p className={cn("text-[10px] mt-2 font-medium text-right", isCustomer ? "text-sky-200" : "text-gray-400")}>
              {formatDateTime(message.timestamp)}
            </p>
          </div>
        )}

        {hasOptionCards && message.metadata?.type === "hotel_options" && (
          <div className="w-full space-y-4">
            <div className="bg-white text-gray-800 border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-5 py-4 text-[15px]">
              <p className="mb-2">Here are the best options I found for you.</p>
              {optionsSelectable && <p className="font-medium text-sky-600">Please review and select an option below:</p>}
              <p className="text-[10px] mt-3 font-medium text-gray-400 text-right">
                {formatDateTime(message.timestamp)}
              </p>
            </div>

            <div className="pl-2">
              {message.metadata.options.map((opt, i) => (
                <OptionCard
                  key={opt.optionId}
                  option={opt}
                  index={i}
                  onSelect={onSelectOption}
                  selectable={optionsSelectable}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {isCustomer && (
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-auto mb-1 border border-gray-200">
          <User className="w-5 h-5 text-gray-500" />
        </div>
      )}
    </div>
  );
}
