import { NextResponse } from "next/server";
import { cancelBooking } from "@/lib/services/workflow";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = body.reason || "Cancelled by operator";

  const result = await cancelBooking(id, reason, {
    force: body.force ?? false,
    sendEmail: true,
    source: "operator",
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ success: true, reason });
}
