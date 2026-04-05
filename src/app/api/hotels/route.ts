import { NextResponse } from "next/server";
import { fetchHotels } from "@/lib/services/hotel-api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const hotels = await fetchHotels({
    location: searchParams.get("location") || undefined,
    maxPrice: searchParams.has("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
    minPrice: searchParams.has("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
    checkIn: searchParams.get("checkIn") || undefined,
    checkOut: searchParams.get("checkOut") || undefined,
    minRating: searchParams.has("minRating") ? Number(searchParams.get("minRating")) : undefined,
    amenities: searchParams.get("amenities")?.split(",") || undefined,
  });

  return NextResponse.json(hotels);
}
