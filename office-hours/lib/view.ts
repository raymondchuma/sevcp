import 'server-only';
import { db } from './db';
import { Booking, bookingAttendees, getBooking, manageToken } from './booking';
import { tokenMatches } from './crypto';
import { formatSlot } from './time';

/** Loads a booking for a founder-facing page, gated by its manage token. */
export async function founderView(id: string, token: string | undefined) {
  const d = await db();
  const b = await getBooking(d, id);
  if (!b || !tokenMatches(token, b.cancellation_token_hash)) return null;
  const people = await bookingAttendees(d, id);
  return { b, people, when: whenOf(b), token: manageToken(b.id) };
}
export function whenOf(b: Booking) {
  const s = formatSlot(new Date(b.start_at), b.timezone), e = formatSlot(new Date(b.end_at), b.timezone);
  return { date: s.date, time: `${s.time} – ${e.time}`, tz: b.timezone };
}
