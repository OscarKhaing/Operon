import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

const stripe = STRIPE_SECRET_KEY
	? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" })
	: null;

export async function createCheckoutSession(params: {
	bookingId: string;
	totalPrice: number;
	hotelName: string;
	roomType: string;
	checkIn: string;
	checkOut: string;
	guestEmail?: string;
	currency?: string;
}): Promise<{ url: string; sessionId: string }> {
	if (!stripe) throw new Error("Stripe secret key not configured");

	const currency = (params.currency || "USD").toLowerCase();
	const session = await stripe.checkout.sessions.create({
		mode: "payment",
		line_items: [
			{
				quantity: 1,
				price_data: {
					currency,
					unit_amount: Math.round(params.totalPrice * 100),
					product_data: {
						name: `${params.hotelName} — ${params.roomType}`,
						description: `Check-in: ${params.checkIn} → Check-out: ${params.checkOut}`,
					},
				},
			},
		],
		customer_email: params.guestEmail || undefined,
		metadata: {
			bookingId: params.bookingId,
		},
		success_url: `${APP_BASE_URL}/?payment=success&bookingId=${params.bookingId}`,
		cancel_url: `${APP_BASE_URL}/?payment=cancelled&bookingId=${params.bookingId}`,
	});

	if (!session.url) {
		throw new Error("Stripe did not return a checkout URL");
	}

	return { url: session.url, sessionId: session.id };
}

export function constructStripeWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
	if (!stripe) throw new Error("Stripe secret key not configured");
	if (!STRIPE_WEBHOOK_SECRET) throw new Error("Stripe webhook secret not configured");
	return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
}
