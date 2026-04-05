import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { store } from "@/lib/store";
import { ChatMessage } from "@/lib/types";
import { constructStripeWebhookEvent } from "@/lib/services/stripe";
import { triggerDispatch } from "@/lib/services/workflow";
import { sendInstagramText } from "@/lib/services/instagram";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("Stripe webhook: missing stripe-signature header");
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const payload = Buffer.from(await req.arrayBuffer());
  let event;
  try {
    event = constructStripeWebhookEvent(payload, signature);
  } catch (error) {
    console.error("Stripe webhook: signature verification failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("Stripe webhook: received event", {
    id: event.id,
    type: event.type,
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      metadata?: { bookingId?: string };
      payment_status?: string;
    };
    const bookingId = session.metadata?.bookingId;

    if (!bookingId) {
      console.error("Stripe webhook: missing bookingId metadata", {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        metadata: session.metadata ?? null,
      });
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
    }

    const booking = store.getBooking(bookingId);
    if (!booking || booking.status !== "awaiting_payment") {
      console.warn("Stripe webhook: booking not awaiting payment", {
        bookingId,
        found: Boolean(booking),
        status: booking?.status ?? null,
      });
      return NextResponse.json({ received: true });
    }

    if (session.payment_status !== "paid") {
      console.warn("Stripe webhook: payment not marked paid", {
        bookingId,
        paymentStatus: session.payment_status ?? null,
      });
      return NextResponse.json({ received: true });
    }

    store.updateBooking(bookingId, {
      status: "filling_template",
      paymentStatus: "paid",
    });

    const options = store.getOptions(bookingId);
    const selectedOption = booking.selectedOptionId
      ? options.find((option) => option.id === booking.selectedOptionId)
      : options[0];
    if (!selectedOption) {
      console.error("Stripe webhook: no selected option found", {
        bookingId,
        optionsCount: options.length,
      });
      return NextResponse.json({ error: "No selected option found" }, { status: 400 });
    }

    console.log("Stripe webhook: dispatching booking", {
      bookingId,
      optionId: selectedOption.id,
    });
    const result = await triggerDispatch(bookingId, selectedOption);
    console.log("Stripe webhook: dispatch complete", {
      bookingId,
      messageLength: result.content.length,
    });

    const agentMsg: ChatMessage = {
      id: uuid(),
      bookingId,
      role: "agent",
      content: result.content,
      timestamp: new Date().toISOString(),
      metadata: result.metadata ?? undefined,
    };
    store.addMessage(agentMsg);

    if (booking.channel === "instagram" && booking.instagramSenderId) {
      await sendInstagramText(booking.instagramSenderId, result.content);
    }
  }

  return NextResponse.json({ received: true });
}
