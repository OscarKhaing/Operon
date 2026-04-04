"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import StatusBadge from "@/components/ui/StatusBadge";
import { BookingRequest, BookingOption, BookingTransaction, ChatMessage } from "@/lib/types";
import { formatDate, formatDateTime, nightsBetween } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  MapPin,
  Calendar,
  Bed,
  DollarSign,
  FileText,
  Send,
  CheckCircle2,
  MessageSquare,
  Download,
} from "lucide-react";
import Link from "next/link";

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<BookingRequest | null>(null);
  const [options, setOptions] = useState<BookingOption[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [filledTemplate, setFilledTemplate] = useState<Record<string, unknown> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((bookings: BookingRequest[]) => {
        const b = bookings.find((bk) => bk.id === bookingId);
        setBooking(b || null);
      });

    fetch(`/api/matching?bookingId=${bookingId}`)
      .then((r) => r.json())
      .then(setOptions);

    fetch(`/api/chat?bookingId=${bookingId}`)
      .then((r) => r.json())
      .then(setMessages);
  }, [bookingId]);

  async function handleFindOptions() {
    setActionLoading("matching");
    const res = await fetch("/api/matching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    const data = await res.json();
    setOptions(data.options || []);

    // Refresh booking
    const bkRes = await fetch("/api/bookings");
    const bookings = await bkRes.json();
    setBooking(bookings.find((b: BookingRequest) => b.id === bookingId) || null);
    setActionLoading(null);
  }

  async function handleSelectOption(optionId: string) {
    setActionLoading("template");
    // Fill template
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, optionId }),
    });
    const data = await res.json();
    setFilledTemplate(data);

    // Refresh booking
    const bkRes = await fetch("/api/bookings");
    const bookings = await bkRes.json();
    setBooking(bookings.find((b: BookingRequest) => b.id === bookingId) || null);
    setActionLoading(null);
  }

  async function handleDispatch(optionId: string) {
    setActionLoading("dispatch");
    const res = await fetch("/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, optionId }),
    });
    const data = await res.json();

    // Simulate confirmation after 1 second
    if (data.transactionId) {
      setTimeout(async () => {
        await fetch("/api/dispatch", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: data.transactionId }),
        });

        // Refresh booking
        const bkRes = await fetch("/api/bookings");
        const bookings = await bkRes.json();
        setBooking(bookings.find((b: BookingRequest) => b.id === bookingId) || null);
        setActionLoading(null);
      }, 1500);
    }
  }

  if (!booking) {
    return (
      <div className="min-h-screen">
        <Header title="Booking Details" />
        <div className="p-6 text-gray-400">Loading...</div>
      </div>
    );
  }

  const nights = booking.travel.checkIn && booking.travel.checkOut
    ? nightsBetween(booking.travel.checkIn, booking.travel.checkOut)
    : 0;

  return (
    <div className="min-h-screen">
      <Header title="Booking Details" />

      <div className="p-6 space-y-6">
        {/* Back + title */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">
                {booking.customer.name || "New Booking"}
              </h2>
              <StatusBadge status={booking.status} />
            </div>
            <p className="text-sm text-gray-500">
              ID: {booking.id} · Created {formatDateTime(booking.createdAt)}
            </p>
          </div>
          <Link
            href="/chat"
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Open Chat
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Customer Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer
            </h3>
            <div className="space-y-3 text-sm">
              <InfoRow label="Name" value={booking.customer.name} />
              <InfoRow label="Passport" value={booking.customer.passport} />
              <InfoRow label="Email" value={booking.customer.email} />
              <InfoRow label="Phone" value={booking.customer.phone} />
              <InfoRow label="Nationality" value={booking.customer.nationality} />
            </div>
          </div>

          {/* Travel Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Travel Details
            </h3>
            <div className="space-y-3 text-sm">
              <InfoRow label="Destination" value={booking.travel.destination} />
              <InfoRow label="Check-in" value={formatDate(booking.travel.checkIn)} />
              <InfoRow label="Check-out" value={formatDate(booking.travel.checkOut)} />
              <InfoRow label="Nights" value={nights ? String(nights) : "—"} />
              <InfoRow label="Guests" value={String(booking.travel.guestCount)} />
              <InfoRow label="Rooms" value={String(booking.travel.roomCount)} />
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Bed className="w-4 h-4" />
              Preferences
            </h3>
            <div className="space-y-3 text-sm">
              <InfoRow label="Room Type" value={booking.preferences.roomType} />
              <InfoRow
                label="Max Budget"
                value={
                  booking.preferences.maxBudgetPerNight
                    ? `$${booking.preferences.maxBudgetPerNight}/night`
                    : "—"
                }
              />
              <InfoRow label="Currency" value={booking.preferences.currency} />
              <InfoRow label="Special Requests" value={booking.preferences.specialRequests} />
            </div>
          </div>
        </div>

        {/* Actions */}
        {booking.status === "extracting" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center justify-between">
            <p className="text-sm text-amber-800">
              Customer information has been extracted. Ready to search for hotel options.
            </p>
            <button
              onClick={handleFindOptions}
              disabled={actionLoading === "matching"}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {actionLoading === "matching" ? "Searching..." : "Find Hotel Options"}
            </button>
          </div>
        )}

        {/* Hotel Options */}
        {options.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Hotel Options
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {options.map((opt, idx) => (
                <div
                  key={opt.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-6"
                >
                  <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 font-bold text-lg">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">
                        {opt.hotelName}
                      </h4>
                      <span className="text-sm text-gray-500">
                        — {opt.roomType.name}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{opt.explanation}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>${opt.roomType.basePrice}/night</span>
                      <span>{opt.nightCount} nights</span>
                      <span className="font-semibold text-gray-900">
                        ${opt.totalPrice} total
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                        Score: {opt.score}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {booking.status === "options_presented" && (
                      <>
                        <button
                          onClick={() => handleSelectOption(opt.id)}
                          disabled={actionLoading === "template"}
                          className="px-3 py-2 bg-violet-500 text-white rounded-lg text-xs font-medium hover:bg-violet-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          Fill Contract
                        </button>
                        <button
                          onClick={() => handleDispatch(opt.id)}
                          disabled={actionLoading === "dispatch"}
                          className="px-3 py-2 bg-sky-500 text-white rounded-lg text-xs font-medium hover:bg-sky-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          {actionLoading === "dispatch" ? "Sending..." : "Send & Confirm"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filled Template Preview */}
        {filledTemplate && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Contract Preview
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">
                {(filledTemplate as Record<string, string>).templateName}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {((filledTemplate as Record<string, unknown>).fields as Array<{
                  label: string;
                  value: string;
                  required: boolean;
                }>)?.map(
                  (field: { label: string; value: string; required: boolean }, i: number) => (
                    <div key={i} className="flex items-baseline gap-2">
                      <span className="text-sm text-gray-500 min-w-[120px]">
                        {field.label}:
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {field.value || (
                          <span className="text-red-400 text-xs">Missing</span>
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reservation PDF */}
        {booking.pdfUrl && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-sm font-medium text-indigo-900">Reservation Document</p>
                <p className="text-xs text-indigo-600">PDF generated and ready for download</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={booking.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                View PDF
              </a>
              <a
                href={booking.pdfUrl}
                download={`reservation-${booking.id}.pdf`}
                className="px-4 py-2 bg-white border border-indigo-300 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          </div>
        )}

        {/* Confirmed State */}
        {booking.status === "confirmed" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-emerald-800">Booking Confirmed</h3>
            <p className="text-sm text-emerald-600 mt-1">
              The hotel has confirmed this reservation. The customer has been notified.
            </p>
          </div>
        )}

        {/* Chat Messages */}
        {messages.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Conversation ({messages.length} messages)
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {messages.map((msg) => (
                <div key={msg.id} className="px-5 py-3 flex gap-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      msg.role === "customer"
                        ? "bg-sky-100 text-sky-700"
                        : msg.role === "agent"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {msg.role}
                  </span>
                  <p className="text-sm text-gray-700 flex-1 whitespace-pre-wrap">
                    {msg.content}
                  </p>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatDateTime(msg.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-800 text-right">{value || "—"}</span>
    </div>
  );
}
