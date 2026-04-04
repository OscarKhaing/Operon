import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/services/llm";

export async function GET() {
  const status = await healthCheck();
  return NextResponse.json(status);
}
