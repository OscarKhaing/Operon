"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBadge from "@/components/ui/StatusBadge";
import { BookingRequest, BookingStatus } from "@/lib/types";
import { formatDate, statusLabel } from "@/lib/utils";
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  Send,
  AlertCircle,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";

const PIPELINE_STAGES: { status: BookingStatus; icon: React.ElementType; color: string }[] = [
  { status: "intake", icon: AlertCircle, color: "bg-indigo-50 text-indigo-600" },
  { status: "extracting", icon: Clock, color: "bg-amber-50 text-amber-600" },
  { status: "options_presented", icon: CalendarCheck, color: "bg-blue-50 text-blue-600" },
  { status: "collecting_info", icon: ClipboardList, color: "bg-pink-50 text-pink-600" },
  { status: "sent_to_hotel", icon: Send, color: "bg-orange-50 text-orange-600" },
  { status: "confirmed", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
];

export default function DashboardPage() {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then(setBookings);
  }, []);

  const byStatus = (status: BookingStatus) =>
    bookings.filter((b) => b.status === status);

  const confirmed = byStatus("confirmed").length;
  const total = bookings.length;
  const activeCount = bookings.filter(
    (b) => !["confirmed", "cancelled"].includes(b.status)
  ).length;

  return (
    <div className="min-h-screen">
      <Header title="Dashboard" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Bookings" value={total} icon={CalendarCheck} color="bg-sky-50 text-sky-600" />
          <StatCard label="Active" value={activeCount} icon={Clock} color="bg-amber-50 text-amber-600" />
          <StatCard label="Confirmed" value={confirmed} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
          <StatCard
            label="Confirmation Rate"
            value={total > 0 ? `${Math.round((confirmed / total) * 100)}%` : "—"}
            icon={TrendingUp}
            color="bg-violet-50 text-violet-600"
          />
        </div>

        {/* Pipeline */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Booking Pipeline
          </h2>
          <div className="grid grid-cols-6 gap-4">
            {PIPELINE_STAGES.map((stage) => {
              const stageBookings = byStatus(stage.status);
              return (
                <div
                  key={stage.status}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${stage.color}`}>
                        <stage.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-gray-600">
                        {statusLabel(stage.status)}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-400">
                      {stageBookings.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[120px]">
                    {stageBookings.map((b) => (
                      <Link
                        key={b.id}
                        href={`/bookings/${b.id}`}
                        className="block p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {b.customer.name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {b.travel.destination} · {formatDate(b.travel.checkIn)}
                        </p>
                      </Link>
                    ))}
                    {stageBookings.length === 0 && (
                      <p className="text-xs text-gray-300 text-center pt-8">
                        No bookings
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Bookings Table */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Recent Bookings
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500">Customer</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Destination</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Dates</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Operator</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/bookings/${b.id}`}
                        className="font-medium text-gray-900 hover:text-sky-600"
                      >
                        {b.customer.name || "Unknown"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {b.travel.destination}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(b.travel.checkIn)} — {formatDate(b.travel.checkOut)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.assignedTo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
