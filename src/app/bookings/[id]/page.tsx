"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import StatusBadge from "@/components/ui/StatusBadge";
import { BookingRequest, BookingOption, ChatMessage } from "@/lib/types";
import { formatDate, formatDateTime, nightsBetween } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  Calendar,
  Bed,
  DollarSign,
  FileText,
  Send,
  CheckCircle2,
  MessageSquare,
  Download,
  Pencil,
  Check,
  X,
  Ban,
  RefreshCw,
  Clock,
} from "lucide-react";
import Link from "next/link";

const OPERATORS = ["Alice", "Bob", "Charlie", "Unassigned"];

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<BookingRequest | null>(null);
  const [options, setOptions] = useState<BookingOption[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [filledTemplate, setFilledTemplate] = useState<Record<string, unknown> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showConfirmInput, setShowConfirmInput] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showCancelInput, setShowCancelInput] = useState(false);

  const refreshBooking = useCallback(async () => {
    const res = await fetch("/api/bookings");
    const bookings: BookingRequest[] = await res.json();
    setBooking(bookings.find((b) => b.id === bookingId) || null);
  }, [bookingId]);

  useEffect(() => {
    refreshBooking();
    fetch(`/api/matching?bookingId=${bookingId}`).then((r) => r.json()).then(setOptions);
    fetch(`/api/chat?bookingId=${bookingId}`).then((r) => r.json()).then(setMessages);
  }, [bookingId, refreshBooking]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function handleFindOptions() {
    setActionLoading("matching");
    const res = await fetch("/api/matching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    const data = await res.json();
    setOptions(data.options || []);
    await refreshBooking();
    setActionLoading(null);
  }

  async function handleSelectOption(optionId: string) {
    setActionLoading("template");
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, optionId }),
    });
    setFilledTemplate(await res.json());
    await refreshBooking();
    setActionLoading(null);
  }

  async function handleDispatch(optionId: string) {
    setActionLoading("dispatch");
    await fetch("/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, optionId }),
    });
    await refreshBooking();
    setActionLoading(null);
  }

  async function handleConfirm() {
    setActionLoading("confirm");
    await fetch(`/api/bookings/${bookingId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationCode: confirmCode || undefined }),
    });
    setShowConfirmInput(false);
    setConfirmCode("");
    await refreshBooking();
    const msgRes = await fetch(`/api/chat?bookingId=${bookingId}`);
    setMessages(await msgRes.json());
    setActionLoading(null);
  }

  async function handleReject() {
    setActionLoading("reject");
    await fetch(`/api/bookings/${bookingId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason || undefined }),
    });
    setShowRejectInput(false);
    setRejectReason("");
    await refreshBooking();
    fetch(`/api/matching?bookingId=${bookingId}`).then((r) => r.json()).then(setOptions);
    const msgRes = await fetch(`/api/chat?bookingId=${bookingId}`);
    setMessages(await msgRes.json());
    setActionLoading(null);
  }

  async function handleCancel() {
    setActionLoading("cancel");
    await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: cancelReason || undefined,
        force: booking?.status === "confirmed",
      }),
    });
    setShowCancelInput(false);
    setCancelReason("");
    await refreshBooking();
    const msgRes = await fetch(`/api/chat?bookingId=${bookingId}`);
    setMessages(await msgRes.json());
    setActionLoading(null);
  }

  async function handleReassign(newOperator: string) {
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookingId, assignedTo: newOperator }),
    });
    await refreshBooking();
  }

  async function handleFieldSave(field: string, value: string) {
    // field is a dot-path like "customer.name" or "travel.checkIn"
    const [section, key] = field.split(".");
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookingId, [section]: { [key]: value } }),
    });
    await refreshBooking();
  }

  if (!booking) {
    return (
      <div className="min-h-screen">
        <Header title="Booking Details" />
        <div className="p-6 text-gray-400">Loading...</div>
      </div>
    );
  }

  const nights =
    booking.travel.checkIn && booking.travel.checkOut
      ? nightsBetween(booking.travel.checkIn, booking.travel.checkOut)
      : 0;

  const isTerminal = ["confirmed", "cancelled"].includes(booking.status);
  const canConfirmReject = booking.status === "sent_to_hotel";
  const canRematch = ["extracting", "options_presented", "selected", "collecting_info"].includes(booking.status);

  return (
    <div className="min-h-screen">
      <Header title="Booking Details" />

      <div className="p-6 space-y-6">
        {/* Back + title + reassign */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
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
          {/* Reassign */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Assigned to:</span>
            <select
              value={booking.assignedTo}
              onChange={(e) => handleReassign(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {OPERATORS.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
          <Link
            href="/chat"
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Open Chat
          </Link>
        </div>

        {/* Status Action Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Cancel (available for non-terminal states) */}
          {!isTerminal && !showCancelInput && (
            <button
              onClick={() => setShowCancelInput(true)}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <Ban className="w-4 h-4" />
              Cancel Booking
            </button>
          )}
          {showCancelInput && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Reason (optional)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 w-56"
              />
              <button
                onClick={handleCancel}
                disabled={actionLoading === "cancel"}
                className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "cancel" ? "Cancelling..." : "Confirm Cancel"}
              </button>
              <button onClick={() => setShowCancelInput(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Confirm/Reject (when sent_to_hotel) */}
          {canConfirmReject && !showConfirmInput && !showRejectInput && (
            <>
              <button
                onClick={() => setShowConfirmInput(true)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark Confirmed
              </button>
              <button
                onClick={() => setShowRejectInput(true)}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Mark Rejected
              </button>
            </>
          )}
          {showConfirmInput && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Confirmation code (optional)..."
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                className="px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-56"
              />
              <button
                onClick={handleConfirm}
                disabled={actionLoading === "confirm"}
                className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "confirm" ? "Confirming..." : "Confirm"}
              </button>
              <button onClick={() => setShowConfirmInput(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {showRejectInput && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 w-56"
              />
              <button
                onClick={handleReject}
                disabled={actionLoading === "reject"}
                className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "reject" ? "Rejecting..." : "Reject"}
              </button>
              <button onClick={() => setShowRejectInput(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Re-run matching */}
          {canRematch && (
            <button
              onClick={handleFindOptions}
              disabled={actionLoading === "matching"}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {actionLoading === "matching" ? "Searching..." : "Re-run Matching"}
            </button>
          )}
        </div>

        {/* Editable info cards */}
        <div className="grid grid-cols-3 gap-6">
          {/* Customer Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer
            </h3>
            <div className="space-y-3 text-sm">
              <EditableInfoRow label="Name" value={booking.customer.name} field="customer.name" onSave={handleFieldSave} />
              <EditableInfoRow label="Passport" value={booking.customer.passport} field="customer.passport" onSave={handleFieldSave} />
              <EditableInfoRow label="Email" value={booking.customer.email} field="customer.email" onSave={handleFieldSave} />
              <EditableInfoRow label="Phone" value={booking.customer.phone} field="customer.phone" onSave={handleFieldSave} />
              <EditableInfoRow label="Nationality" value={booking.customer.nationality} field="customer.nationality" onSave={handleFieldSave} />
            </div>
          </div>

          {/* Travel Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Travel Details
            </h3>
            <div className="space-y-3 text-sm">
              <EditableInfoRow label="Destination" value={booking.travel.destination} field="travel.destination" onSave={handleFieldSave} />
              <EditableInfoRow label="Check-in" value={booking.travel.checkIn} field="travel.checkIn" onSave={handleFieldSave} type="date" />
              <EditableInfoRow label="Check-out" value={booking.travel.checkOut} field="travel.checkOut" onSave={handleFieldSave} type="date" />
              <InfoRow label="Nights" value={nights ? String(nights) : "—"} />
              <EditableInfoRow label="Guests" value={String(booking.travel.guestCount)} field="travel.guestCount" onSave={handleFieldSave} type="number" />
              <EditableInfoRow label="Rooms" value={String(booking.travel.roomCount)} field="travel.roomCount" onSave={handleFieldSave} type="number" />
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Bed className="w-4 h-4" />
              Preferences
            </h3>
            <div className="space-y-3 text-sm">
              <EditableInfoRow
                label="Room Type"
                value={booking.preferences.roomType}
                field="preferences.roomType"
                onSave={handleFieldSave}
                selectOptions={["standard", "deluxe", "suite"]}
              />
              <EditableInfoRow
                label="Max Budget"
                value={String(booking.preferences.maxBudgetPerNight || "")}
                field="preferences.maxBudgetPerNight"
                onSave={handleFieldSave}
                type="number"
                displayValue={booking.preferences.maxBudgetPerNight ? `$${booking.preferences.maxBudgetPerNight}/night` : "—"}
              />
              <InfoRow label="Currency" value={booking.preferences.currency} />
              <EditableInfoRow label="Special Requests" value={booking.preferences.specialRequests} field="preferences.specialRequests" onSave={handleFieldSave} />
            </div>
          </div>
        </div>

        {/* Awaiting hotel response */}
        {booking.status === "sent_to_hotel" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center gap-4">
            <Clock className="w-6 h-6 text-amber-500 animate-pulse" />
            <div>
              <p className="text-sm font-medium text-amber-900">Awaiting Payment</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Reservation prepared. Waiting for customer to complete payment.
              </p>
            </div>
          </div>
        )}

        {/* Hotel Options */}
        {options.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Available Options
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {options.map((opt, idx) => {
                const isRejected = booking.rejectedOptionIds?.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className={`bg-white rounded-xl border p-5 flex items-center gap-6 ${isRejected ? "border-red-200 opacity-60" : "border-gray-200"}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isRejected ? "bg-red-50 text-red-400" : "bg-sky-50 text-sky-600"}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">
                          {opt.category === "hotel" ? opt.hotelName : opt.category === "flight" ? `${opt.airline} ${opt.flightNumber}` : opt.restaurantName}
                        </h4>
                        <span className="text-sm text-gray-500">
                          — {opt.category === "hotel" ? opt.roomType.name : opt.category === "flight" ? `${opt.origin} → ${opt.destination}` : opt.cuisine}
                        </span>
                        {isRejected && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-medium">Rejected</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{opt.explanation}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {opt.category === "hotel" && <><span>${opt.roomType.basePrice}/night</span><span>{opt.nightCount} nights</span></>}
                        {opt.category === "flight" && <span>{opt.cabinClass}</span>}
                        {opt.category === "restaurant" && <><span>{opt.priceRange}/person</span><span>{opt.rating} stars</span></>}
                        <span className="font-semibold text-gray-900">${opt.totalPrice} total</span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                          Score: {opt.score}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {booking.status === "options_presented" && !isRejected && (
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
                );
              })}
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
                      <span className="text-sm text-gray-500 min-w-[120px]">{field.label}:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {field.value || <span className="text-red-400 text-xs">Missing</span>}
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
              This reservation has been confirmed. The customer has been notified.
            </p>
          </div>
        )}

        {/* Cancelled State */}
        {booking.status === "cancelled" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <Ban className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-red-800">Booking Cancelled</h3>
            <p className="text-sm text-red-600 mt-1">
              This booking has been cancelled.
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
                  <p className="text-sm text-gray-700 flex-1 whitespace-pre-wrap">{msg.content}</p>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(msg.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-800 text-right">{value || "—"}</span>
    </div>
  );
}

function EditableInfoRow({
  label,
  value,
  field,
  onSave,
  type = "text",
  displayValue,
  selectOptions,
}: {
  label: string;
  value: string;
  field: string;
  onSave: (field: string, value: string) => Promise<void>;
  type?: "text" | "date" | "number";
  displayValue?: string;
  selectOptions?: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(field, draft);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex justify-between items-center gap-2">
        <span className="text-gray-400 text-xs flex-shrink-0">{label}</span>
        <div className="flex items-center gap-1">
          {selectOptions ? (
            <select
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="px-2 py-1 border border-sky-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              autoFocus
            >
              {selectOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="px-2 py-1 border border-sky-300 rounded text-xs w-32 focus:outline-none focus:ring-1 focus:ring-sky-500"
              autoFocus
            />
          )}
          <button onClick={save} disabled={saving} className="p-1 text-emerald-500 hover:text-emerald-700">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={() => { setEditing(false); setDraft(value); }} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center group">
      <span className="text-gray-400">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-medium text-gray-800 text-right">{displayValue || value || "—"}</span>
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-sky-500 transition-all"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
