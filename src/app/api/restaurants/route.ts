import { NextResponse } from "next/server";
import { fetchRestaurants } from "@/lib/services/restaurant-api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const restaurants = await fetchRestaurants({
    location: searchParams.get("location") || undefined,
    cuisine: searchParams.get("cuisine") || undefined,
    priceRange: searchParams.get("priceRange") || undefined,
  });

  return NextResponse.json(restaurants);
}
