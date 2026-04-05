"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { RestaurantRecord } from "@/lib/types";
import { Search, Star, MapPin, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<RestaurantRecord[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/restaurants")
      .then((r) => r.json())
      .then(setRestaurants);
  }, []);

  const filtered = restaurants.filter(
    (r) =>
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.location.toLowerCase().includes(search.toLowerCase()) ||
      r.cuisine.toLowerCase().includes(search.toLowerCase()) ||
      r.amenities.some((a) => a.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen">
      <Header title="Restaurant Partners" />

      <div className="p-6 space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, location, cuisine, or amenity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((restaurant) => (
            <div key={restaurant.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 text-lg">{restaurant.name}</h3>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-semibold text-gray-700">{restaurant.rating}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
                <MapPin className="w-3.5 h-3.5" />
                <span>{restaurant.location}</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                  {restaurant.cuisine}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                  ${restaurant.priceRange}/person
                </span>
              </div>

              {restaurant.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {restaurant.amenities.map((amenity) => (
                    <span key={amenity} className="text-[10px] px-2 py-1 bg-gray-100 text-gray-500 rounded-md uppercase tracking-wider font-medium">
                      {amenity}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No restaurants found</p>
          </div>
        )}
      </div>
    </div>
  );
}
