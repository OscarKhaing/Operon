import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ChatMessage } from "@/lib/types";
import { processMessage } from "@/lib/services/workflow";
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
  const body = await req.json();
  const { bookingId, content } = body;

  if (!bookingId || !content) {
    return NextResponse.json({ error: "bookingId and content required" }, { status: 400 });
  }

  // Save customer message
  const customerMsg: ChatMessage = {
    id: uuid(),
    bookingId,
    role: "customer",
    content,
    timestamp: new Date().toISOString(),
  };
  store.addMessage(customerMsg);

  // Process through the LLM-driven workflow state machine
  let agentContent: string;
  try {
    agentContent = await processMessage(bookingId, content);
  } catch (error) {
    console.error("Workflow error:", error);
    agentContent =
      "I'm having a bit of trouble processing that right now. Could you try again in a moment?";
  }

  // Save agent reply
  const agentMsg: ChatMessage = {
    id: uuid(),
    bookingId,
    role: "agent",
    content: agentContent,
    timestamp: new Date().toISOString(),
  };
  store.addMessage(agentMsg);

  // Return the updated booking state too
  const booking = store.getBooking(bookingId);

  return NextResponse.json({
    customerMessage: customerMsg,
    agentMessage: agentMsg,
    bookingStatus: booking?.status,
  });
}
