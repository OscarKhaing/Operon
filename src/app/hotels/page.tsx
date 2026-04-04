"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { HotelRecord } from "@/lib/types";
import { Search, Star, MapPin, Mail, Phone } from "lucide-react";

export default function HotelsPage() {
  const [hotels, setHotels] = useState<HotelRecord[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/hotels")
      .then((r) => r.json())
      .then(setHotels);
  }, []);

  const filtered = hotels.filter(
    (h) =>
      !search ||
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.city.toLowerCase().includes(search.toLowerCase()) ||
      h.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen">
      <Header title="Contracted Hotels" />

      <div className="p-6 space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search hotels by name, city, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Hotel Cards */}
        <div className="grid grid-cols-2 gap-6">
          {filtered.map((hotel) => (
            <div
              key={hotel.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Hotel Header */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{hotel.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      <MapPin className="w-3.5 h-3.5" />
                      {hotel.location}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: hotel.stars }).map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 text-amber-400 fill-amber-400"
                      />
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {hotel.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Contact */}
                <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {hotel.contactEmail}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {hotel.contactPhone}
                  </span>
                </div>
              </div>

              {/* Room Types */}
              <div className="border-t border-gray-100">
                <button
                  onClick={() =>
                    setExpandedId(expandedId === hotel.id ? null : hotel.id)
                  }
                  className="w-full px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  Room Types ({hotel.roomTypes.length})
                  <span className="text-gray-300">
                    {expandedId === hotel.id ? "−" : "+"}
                  </span>
                </button>
                {expandedId === hotel.id && (
                  <div className="px-5 pb-4 space-y-3">
                    {hotel.roomTypes.map((room) => (
                      <div
                        key={room.id}
                        className="p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-900">
                            {room.name}
                          </span>
                          <span className="text-sm font-bold text-sky-600">
                            ${room.basePrice}/night
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Max {room.maxGuests} guests · {room.amenities.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-400">
              No hotels found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
