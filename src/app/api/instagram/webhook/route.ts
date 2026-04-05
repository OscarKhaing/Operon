import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { store } from "@/lib/store";
import { ChatMessage, MessageMetadata, HotelOptionCard, BookingRequest } from "@/lib/types";
import { processMessage } from "@/lib/services/workflow";
import {
  sendInstagramText,
  sendInstagramTemplate,
  InstagramTemplateElement,
} from "@/lib/services/instagram";

const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Verification failed", { status: 403 });
}

export async function POST(req: Request) {
  const data = await req.json();

  console.log("[instagram] webhook event received:", {
    object: data?.object,
    entryCount: Array.isArray(data?.entry) ? data.entry.length : 0,
  });

  if (data?.object !== "instagram") {
    console.log("[instagram] ignored event (non-instagram)");
    return NextResponse.json({ status: "IGNORED" });
  }

  const entries: Array<{ messaging?: Array<Record<string, unknown>> }> = data.entry ?? [];
  for (const entry of entries) {
    const events = entry.messaging ?? [];
    for (const event of events) {
      const senderId = (event as any)?.sender?.id as string | undefined;
      if (!senderId) continue;

      const message = (event as any)?.message;
      const postback = (event as any)?.postback;

      if (message?.is_echo) continue;

      try {
        if (message?.text) {
          console.log("[instagram] text message", {
            senderId,
            text: String(message.text),
          });
          await handleIncomingText(senderId, String(message.text));
        } else if (postback?.payload) {
          console.log("[instagram] postback", {
            senderId,
            payload: String(postback.payload),
          });
          await handlePostback(senderId, String(postback.payload));
        } else {
          console.log("[instagram] unsupported event", {
            senderId,
            hasMessage: Boolean(message),
            hasPostback: Boolean(postback),
          });
        }
      } catch (error) {
        console.error("Instagram webhook handling error:", error);
      }
    }
  }

  return NextResponse.json({ status: "EVENT_RECEIVED" });
}

async function handleIncomingText(senderId: string, text: string): Promise<void> {
  const booking = findOrCreateInstagramBooking(senderId);

  const customerMsg: ChatMessage = {
    id: uuid(),
    bookingId: booking.id,
    role: "customer",
    content: text,
    timestamp: new Date().toISOString(),
  };
  store.addMessage(customerMsg);

  let result: { content: string; metadata?: MessageMetadata };
  try {
    result = await processMessage(booking.id, text);
  } catch (error) {
    console.error("Workflow error:", error);
    result = { content: "I'm having a bit of trouble right now. Please try again in a moment." };
  }

  const agentMsg: ChatMessage = {
    id: uuid(),
    bookingId: booking.id,
    role: "agent",
    content: result.content,
    timestamp: new Date().toISOString(),
    metadata: result.metadata ?? undefined,
  };
  store.addMessage(agentMsg);

  await sendInstagramResponse(senderId, result.content, result.metadata);
}

async function handlePostback(senderId: string, payload: string): Promise<void> {
  const booking = findOrCreateInstagramBooking(senderId);
  const selection = parseOptionPayload(payload, booking.id);

  if (!selection) {
    await sendInstagramText(senderId, "I didn't recognize that selection. Please reply with an option number.");
    return;
  }

  const metadata: MessageMetadata = {
    type: "option_selected",
    optionIndex: selection.optionIndex,
    optionId: selection.optionId,
  };

  const customerMsg: ChatMessage = {
    id: uuid(),
    bookingId: booking.id,
    role: "customer",
    content: `Selected option ${selection.optionIndex}`,
    timestamp: new Date().toISOString(),
    metadata,
  };
  store.addMessage(customerMsg);

  let result: { content: string; metadata?: MessageMetadata };
  try {
    result = await processMessage(booking.id, customerMsg.content, metadata);
  } catch (error) {
    console.error("Workflow error:", error);
    result = { content: "I'm having a bit of trouble right now. Please try again in a moment." };
  }

  const agentMsg: ChatMessage = {
    id: uuid(),
    bookingId: booking.id,
    role: "agent",
    content: result.content,
    timestamp: new Date().toISOString(),
    metadata: result.metadata ?? undefined,
  };
  store.addMessage(agentMsg);

  await sendInstagramResponse(senderId, result.content, result.metadata);
}

function findOrCreateInstagramBooking(senderId: string): BookingRequest {
  const existing = store.findBookingByInstagramSenderId(senderId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const booking: BookingRequest = {
    id: uuid(),
    customer: { name: "", passport: "", email: "", phone: "", nationality: "" },
    travel: { checkIn: "", checkOut: "", guestCount: 1, roomCount: 1, destination: "" },
    preferences: { roomType: "standard", maxBudgetPerNight: 200, currency: "USD", specialRequests: "" },
    status: "intake",
    assignedTo: "Instagram",
    channel: "instagram",
    instagramSenderId: senderId,
    createdAt: now,
    updatedAt: now,
  };

  store.createBooking(booking);
  return booking;
}

function parseOptionPayload(
  payload: string,
  bookingId: string
): { optionIndex: number; optionId: string } | null {
  if (!payload.startsWith("option:")) return null;
  const parts = payload.split(":");
  const index = Number(parts[1]);
  if (!Number.isInteger(index) || index < 1) return null;

  let optionId = parts[2] || "";
  if (!optionId) {
    const options = store.getOptions(bookingId).slice(0, 5);
    optionId = options[index - 1]?.id || "";
  }

  if (!optionId) return null;
  return { optionIndex: index, optionId };
}

async function sendInstagramResponse(
  recipientId: string,
  content: string,
  metadata: MessageMetadata | undefined
): Promise<void> {
  if (metadata?.type === "hotel_options") {
    await sendInstagramText(recipientId, content);
    const elements = buildOptionElements(metadata.options);
    await sendInstagramTemplate(recipientId, elements);
    return;
  }

  await sendInstagramText(recipientId, content);
}

function buildOptionElements(options: HotelOptionCard[]): InstagramTemplateElement[] {
  return options.map((opt, idx) => {
    const optionIndex = idx + 1;
    const title = `${opt.hotelName} - ${opt.roomType}`;
    const subtitle = `$${opt.pricePerNight}/night | $${opt.totalPrice} total | ${opt.stars} stars`;
    const imageUrl = `https://placehold.co/600x315/png?text=${encodeURIComponent(opt.hotelName)}`;

    return {
      title,
      subtitle,
      image_url: imageUrl,
      buttons: [
        {
          type: "postback",
          title: `Select option ${optionIndex}`,
          payload: `option:${optionIndex}:${opt.optionId}`,
        },
      ],
    };
  });
}
