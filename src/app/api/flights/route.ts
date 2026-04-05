import { NextResponse } from "next/server";
import { fetchFlights } from "@/lib/services/flight-api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const flights = await fetchFlights({
    origin: searchParams.get("origin") || undefined,
    destination: searchParams.get("destination") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    maxPrice: searchParams.has("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
    cabinClass: searchParams.get("cabinClass") || undefined,
    provider: searchParams.get("provider") || undefined,
  });

  return NextResponse.json(flights);
}
