"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBadge from "@/components/ui/StatusBadge";
import { BookingRequest, BookingStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Search, Filter } from "lucide-react";
import Link from "next/link";

const STATUS_FILTERS: (BookingStatus | "all")[] = [
  "all",
  "intake",
  "extracting",
  "options_presented",
  "sent_to_hotel",
  "confirmed",
  "cancelled",
];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then(setBookings);
  }, []);

  const filtered = bookings.filter((b) => {
    const matchesSearch =
      !search ||
      b.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      b.travel.destination.toLowerCase().includes(search.toLowerCase()) ||
      b.id.includes(search);
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen">
      <Header title="Bookings" />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, destination, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-sky-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">ID</th>
                <th className="px-4 py-3 font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 font-medium text-gray-500">Destination</th>
                <th className="px-4 py-3 font-medium text-gray-500">Check-in</th>
                <th className="px-4 py-3 font-medium text-gray-500">Check-out</th>
                <th className="px-4 py-3 font-medium text-gray-500">Guests</th>
                <th className="px-4 py-3 font-medium text-gray-500">Room</th>
                <th className="px-4 py-3 font-medium text-gray-500">Budget</th>
                <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Operator</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {b.id}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/bookings/${b.id}`}
                      className="font-medium text-gray-900 hover:text-sky-600"
                    >
                      {b.customer.name || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.travel.destination || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(b.travel.checkIn)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(b.travel.checkOut)}</td>
                  <td className="px-4 py-3 text-gray-600">{b.travel.guestCount}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{b.preferences.roomType}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {b.preferences.maxBudgetPerNight
                      ? `$${b.preferences.maxBudgetPerNight}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.assignedTo}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    No bookings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
