import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ChatMessage, MessageMetadata } from "@/lib/types";
import { processMessage } from "@/lib/services/workflow";
import { validateChatPost } from "@/lib/validation";
import { v4 as uuid } from "uuid";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }
  return NextResponse.json(store.getMessages(bookingId));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const v = validateChatPost(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }
  const { bookingId, content, metadata, role } = v.data;

  // ── Agent mode: operator types directly as agent, bypasses workflow ──
  if (role === "agent") {
    const agentMsg: ChatMessage = {
      id: uuid(),
      bookingId,
      role: "agent",
      content,
      timestamp: new Date().toISOString(),
    };
    store.addMessage(agentMsg);

    const booking = store.getBooking(bookingId);
    return NextResponse.json({
      agentMessage: agentMsg,
      bookingStatus: booking?.status,
    });
  }

  // ── Normal customer message flow ──

  // Save customer message (with metadata if present, e.g. option_selected)
  const customerMsg: ChatMessage = {
    id: uuid(),
    bookingId,
    role: "customer",
    content,
    timestamp: new Date().toISOString(),
    metadata: (metadata as MessageMetadata) ?? undefined,
  };
  store.addMessage(customerMsg);

  // Process through the LLM-driven workflow state machine.
  // If metadata.type === "option_selected", this bypasses LLM entirely.
  let result: { content: string; metadata?: MessageMetadata };
  try {
    result = await processMessage(bookingId, content, metadata as MessageMetadata);
  } catch (error) {
    console.error("Workflow error:", error);

    // Detect Gemini quota / out-of-credits errors and show a playful message
    const errMsg = error instanceof Error ? error.message : String(error);
    const isQuotaError = /429|quota|RESOURCE_EXHAUSTED|rate.?limit|exceeded|billing/i.test(errMsg);

    if (isQuotaError) {
      result = {
        content:
          "🧠💸 Our AI brain is out of credits! Operon was built on a hackathon budget and we've burned through Google Gemini's free tier. The chat will be back online once credits are refilled (or someone sends us a few bucks). Sorry for the awkward timing!",
      };
    } else {
      result = {
        content: "I'm having a bit of trouble processing that right now. Could you try again in a moment?",
      };
    }
  }

  // Save agent reply (with metadata if workflow returned it, e.g. hotel_options)
  const agentMsg: ChatMessage = {
    id: uuid(),
    bookingId,
    role: "agent",
    content: result.content,
    timestamp: new Date().toISOString(),
    metadata: result.metadata ?? undefined,
  };
  store.addMessage(agentMsg);

  const booking = store.getBooking(bookingId);

  return NextResponse.json({
    customerMessage: customerMsg,
    agentMessage: agentMsg,
    bookingStatus: booking?.status,
  });
}
