import 'server-only';
import { NextResponse } from 'next/server';
import { BookingError } from './booking';

const STATUS: Record<BookingError['code'], number> = { invalid: 400, slot_unavailable: 409, unverified: 503, not_configured: 503, calendar_failed: 502, not_found: 404, forbidden: 403, rate_limited: 429 };

export function errorResponse(e: unknown) {
  if (e instanceof BookingError) return NextResponse.json({ error: e.code, message: e.message }, { status: STATUS[e.code] });
  console.error('[office-hours]', (e as Error)?.message);   // never log tokens or payloads
  return NextResponse.json({ error: 'server_error', message: 'Something went wrong. Please try again.' }, { status: 500 });
}
export const tooMany = () => NextResponse.json({ error: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
