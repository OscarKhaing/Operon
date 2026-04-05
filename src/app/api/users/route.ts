import { NextResponse } from "next/server";

// This matches your frontend interface
function transformUser(backendUser: any) {
  return {
    // Ensure ID is always a string for React keys
    _id: typeof backendUser._id === "object" ? backendUser._id.$oid : backendUser._id,
    fullName: backendUser.fullName || "Unknown",
    email: backendUser.email || "—",
    phone: backendUser.phone || "—",
    nationality: backendUser.nationality || "—",
    passportNumber: backendUser.passportNumber || "—",
    insta_tag: backendUser.insta_tag || "—",
    // Ensure dates are string-formatted for the formatDate utility
    birthday: backendUser.birthday?.$date || backendUser.birthday,
    previousTrip: backendUser.previousTrip ? {
      destination: backendUser.previousTrip.destination,
      date: backendUser.previousTrip.date?.$date || backendUser.previousTrip.date
    } : null
  };
}

export async function GET() {
  try {
    // 1. Fetch from your Express Backend
    const response = await fetch('http://localhost:5001/api/users', {
      cache: 'no-store' // Ensure we get fresh data every time
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
    }

    const data = await response.json();
    
    // 2. Transform the data to match your Frontend Table
    const users = Array.isArray(data) ? data.map(transformUser) : [];

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error in Users API Route:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}