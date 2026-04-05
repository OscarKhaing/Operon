/**
 * Lightweight request validation for API routes.
 * Each validator returns { ok, data, error } — call at the top of route handlers.
 */

type ValidationResult<T> =
  | { ok: true; data: T; error?: undefined }
  | { ok: false; data?: undefined; error: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !isNaN(v);
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function isISODate(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(Date.parse(v));
}

// ─── Chat POST ──────────────────────────────────────────────────────────────

export interface ChatPostInput {
  bookingId: string;
  content: string;
  role?: "customer" | "agent";
  metadata?: { type: string; [key: string]: unknown } | null;
}

export function validateChatPost(body: unknown): ValidationResult<ChatPostInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.bookingId)) {
    return { ok: false, error: "bookingId is required and must be a non-empty string" };
  }
  if (!isNonEmptyString(b.content)) {
    return { ok: false, error: "content is required and must be a non-empty string" };
  }
  if (b.role !== undefined && b.role !== "customer" && b.role !== "agent") {
    return { ok: false, error: "role must be 'customer' or 'agent'" };
  }

  return {
    ok: true,
    data: {
      bookingId: b.bookingId as string,
      content: (b.content as string).trim(),
      role: b.role as "customer" | "agent" | undefined,
      metadata: (b.metadata as ChatPostInput["metadata"]) ?? null,
    },
  };
}

// ─── Booking PATCH ──────────────────────────────────────────────────────────

export interface BookingPatchInput {
  id: string;
  customer?: Record<string, unknown>;
  travel?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  [key: string]: unknown;
}

export function validateBookingPatch(body: unknown): ValidationResult<BookingPatchInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.id)) {
    return { ok: false, error: "id is required and must be a non-empty string" };
  }

  // Validate nested objects are objects if present
  if (b.customer !== undefined && (typeof b.customer !== "object" || b.customer === null)) {
    return { ok: false, error: "customer must be an object" };
  }
  if (b.travel !== undefined && (typeof b.travel !== "object" || b.travel === null)) {
    return { ok: false, error: "travel must be an object" };
  }
  if (b.preferences !== undefined && (typeof b.preferences !== "object" || b.preferences === null)) {
    return { ok: false, error: "preferences must be an object" };
  }

  return { ok: true, data: b as BookingPatchInput };
}

// ─── Matching POST ──────────────────────────────────────────────────────────

export interface MatchingPostInput {
  bookingId: string;
}

export function validateMatchingPost(body: unknown): ValidationResult<MatchingPostInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.bookingId)) {
    return { ok: false, error: "bookingId is required and must be a non-empty string" };
  }

  return { ok: true, data: { bookingId: b.bookingId as string } };
}

// ─── Dispatch POST ──────────────────────────────────────────────────────────

export interface DispatchPostInput {
  bookingId: string;
  optionId: string;
}

export function validateDispatchPost(body: unknown): ValidationResult<DispatchPostInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.bookingId)) {
    return { ok: false, error: "bookingId is required and must be a non-empty string" };
  }
  if (!isNonEmptyString(b.optionId)) {
    return { ok: false, error: "optionId is required and must be a non-empty string" };
  }

  return { ok: true, data: { bookingId: b.bookingId as string, optionId: b.optionId as string } };
}

// ─── Dispatch PATCH (simulate confirmation) ─────────────────────────────────

export interface DispatchPatchInput {
  transactionId: string;
}

export function validateDispatchPatch(body: unknown): ValidationResult<DispatchPatchInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.transactionId)) {
    return { ok: false, error: "transactionId is required and must be a non-empty string" };
  }

  return { ok: true, data: { transactionId: b.transactionId as string } };
}

// ─── Templates POST ─────────────────────────────────────────────────────────

export interface TemplatesPostInput {
  bookingId: string;
  optionId: string;
}

export function validateTemplatesPost(body: unknown): ValidationResult<TemplatesPostInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.bookingId)) {
    return { ok: false, error: "bookingId is required and must be a non-empty string" };
  }
  if (!isNonEmptyString(b.optionId)) {
    return { ok: false, error: "optionId is required and must be a non-empty string" };
  }

  return { ok: true, data: { bookingId: b.bookingId as string, optionId: b.optionId as string } };
}
