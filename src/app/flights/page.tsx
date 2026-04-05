"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { FlightRecord } from "@/lib/types";
import { Search, Plane } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FlightsPage() {
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/flights")
      .then((r) => r.json())
      .then(setFlights);
  }, []);

  const filtered = flights.filter(
    (f) =>
      !search ||
      f.airline.toLowerCase().includes(search.toLowerCase()) ||
      f.origin.toLowerCase().includes(search.toLowerCase()) ||
      f.destination.toLowerCase().includes(search.toLowerCase()) ||
      f.flightNumber.toLowerCase().includes(search.toLowerCase()) ||
      f.cabinClass.toLowerCase().includes(search.toLowerCase())
  );

  const cabinColors: Record<string, string> = {
    Economy: "bg-gray-100 text-gray-700",
    "Premium Economy": "bg-blue-100 text-blue-700",
    Business: "bg-indigo-100 text-indigo-700",
    First: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="min-h-screen">
      <Header title="Flight Inventory" />

      <div className="p-6 space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by airline, route, flight number, or class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((flight) => (
            <div key={flight.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-sky-500" />
                  <span className="font-semibold text-gray-900">{flight.airline}</span>
                </div>
                <span className="text-sm font-mono text-gray-500">{flight.flightNumber}</span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-700">{flight.origin}</span>
                <span className="text-gray-400">→</span>
                <span className="text-sm text-gray-700">{flight.destination}</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cabinColors[flight.cabinClass] || "bg-gray-100 text-gray-600")}>
                  {flight.cabinClass}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                  {flight.inventory} seats
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-500">Base: </span>
                  <span className="text-gray-400 line-through">${flight.basePrice}</span>
                  <span className="ml-2 font-bold text-sky-700">${flight.price}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(flight.departureDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Plane className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No flights found</p>
          </div>
        )}
      </div>
    </div>
  );
}
