import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { db, Q } from './db';
import { eventIdFor, sha256, tokenMatches } from './crypto';
import { availability } from './availability';
import { calendar, CalEvent, GoogleError, NotConnectedError } from './google';
import { baseUrl } from './google/oauth';
import { getSettings } from './settings';
import { candidateSlots, dayKey, formatSlot } from './time';

export class BookingError extends Error {
  constructor(public code: 'invalid' | 'slot_unavailable' | 'unverified' | 'not_configured' | 'calendar_failed' | 'not_found' | 'forbidden' | 'rate_limited', message: string) { super(message); }
}

export interface Booking {
  id: string; first_name: string; surname: string; email: string; startup_name: string; session_notes: string | null;
  start_at: Date; end_at: Date; timezone: string; status: 'pending' | 'confirmed' | 'cancelled' | 'failed';
  google_event_id: string; google_meet_url: string | null; cancellation_token_hash: string; cancelled_at: Date | null; created_at: Date;
}
export interface BookingInput { firstName: string; surname: string; email: string; startupName: string; notes?: string; start: string; idempotencyKey?: string }

/** Founder's manage (cancel/reschedule) token. Deterministic per booking so a retried submit can return it; only its hash is stored. */
export function manageToken(bookingId: string) {
  const key = process.env.SESSION_SECRET || (process.env.VERCEL ? '' : 'sevcp-office-hours-dev-SESSION_SECRET');
  if (!key) throw new Error('SESSION_SECRET must be set in production');
  return createHmac('sha256', key).update(`manage:${bookingId}`).digest('base64url');
}
export const manageUrl = (id: string) => `${baseUrl()}/office-hours/manage/${id}?t=${manageToken(id)}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, process.env.VITEST ? Math.min(ms, 5) : ms));
const isOverlap = (e: unknown) => (e as { code?: string })?.code === '23P01';
const isUnique = (e: unknown) => (e as { code?: string })?.code === '23505';

async function op(q: Q, bookingId: string | null, type: string, payload?: object) {
  const [r] = await q.query<{ id: string }>(`INSERT INTO booking_operations (booking_id, operation_type, status, payload) VALUES ($1, $2, 'pending', $3) RETURNING id`, [bookingId, type, payload ? JSON.stringify(payload) : null]);
  return r.id;
}
async function finishOp(q: Q, id: string, status: 'succeeded' | 'failed', attempts: number, error?: string) {
  await q.query(`UPDATE booking_operations SET status = $2, attempt_count = attempt_count + $3, error_message = $4, updated_at = now() WHERE id = $1`, [id, status, attempts, error || null]);
}

export async function getBooking(q: Q, id: string): Promise<Booking | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [b] = await q.query<Booking>('SELECT * FROM bookings WHERE id = $1', [id]);
  return b || null;
}
export async function bookingAttendees(q: Q, id: string) {
  return q.query<{ name: string | null; email: string; role: string; is_optional: boolean }>(`SELECT name, email, role, is_optional FROM booking_attendees WHERE booking_id = $1 ORDER BY CASE role WHEN 'host' THEN 0 WHEN 'cohost' THEN 1 ELSE 2 END, created_at`, [id]);
}

/** Validates that `startIso` is exactly one of today's rule-generated slots; returns it. */
async function resolveSlot(q: Q, startIso: string) {
  const settings = await getSettings(q);
  const start = new Date(startIso);
  if (isNaN(start.getTime())) throw new BookingError('invalid', 'Choose a valid appointment time.');
  const day = dayKey(start, settings.timezone);
  const slot = candidateSlots(settings, day, day).find((c) => c.start.getTime() === start.getTime());
  if (!slot) throw new BookingError('slot_unavailable', 'That time is outside office hours or no longer bookable. Please pick another slot.');
  return { settings, slot };
}

/** Takes the per-day lock, enforces the daily cap and inserts the slot hold. Throws slot_unavailable on any conflict. */
async function hold(q: Q, bookingId: string, start: Date, end: Date, day: string, kind: 'booking' | 'reschedule', bufferMin: number, maxPerDay: number, ignoreBookingId?: string) {
  await q.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`sevcp-oh:${day}`]);
  const [{ n }] = await q.query<{ n: number }>(`SELECT count(*)::int AS n FROM reservations WHERE local_day = $1 AND kind = 'booking' AND booking_id IS DISTINCT FROM $2`, [day, ignoreBookingId || null]);
  if (n >= maxPerDay) throw new BookingError('slot_unavailable', 'That day is fully booked. Please choose another date.');
  try {
    await q.query(`INSERT INTO reservations (booking_id, slot, local_day, kind) VALUES ($1, tstzrange($2, $3), $4, $5)`, [bookingId, start, new Date(end.getTime() + bufferMin * 60000), day, kind]);
  } catch (e) {
    if (isOverlap(e)) throw new BookingError('slot_unavailable', 'Someone just booked that time. Please choose another slot.');
    throw e;
  }
}

/** Public booking: final availability check → atomic hold → one shared calendar event → verify → confirm. */
export async function createBooking(input: BookingInput): Promise<{ booking: Booking; token: string }> {
  const d = await db();
  if (input.idempotencyKey) {
    const [prev] = await d.query<Booking>('SELECT * FROM bookings WHERE idempotency_key = $1', [input.idempotencyKey]);
    if (prev) return { booking: prev, token: manageToken(prev.id) };
  }
  const { settings, slot } = await resolveSlot(d, input.start);

  // Final validation against every required calendar (fails closed if any can't be read).
  const av = await availability(d, slot.day, slot.day);
  if (!av.ok) throw new BookingError(av.reason === 'not_configured' ? 'not_configured' : 'unverified', av.message);
  if (!av.slots.some((s) => s.start.getTime() === slot.start.getTime())) throw new BookingError('slot_unavailable', 'That time was just taken or a host became unavailable. Please choose another slot.');

  const id = randomUUID();
  const token = manageToken(id);
  try {
    await d.tx(async (q) => {
      await q.query(`INSERT INTO bookings (id, first_name, surname, email, startup_name, session_notes, start_at, end_at, timezone, status, google_event_id, cancellation_token_hash, idempotency_key)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12)`,
        [id, input.firstName, input.surname, input.email.toLowerCase(), input.startupName, input.notes || null, slot.start, slot.end, settings.timezone, eventIdFor(id), sha256(token), input.idempotencyKey || null]);
      await hold(q, id, slot.start, slot.end, slot.day, 'booking', settings.buffer_minutes, settings.maximum_bookings_per_day);
      for (const a of av.attendees) await q.query(`INSERT INTO booking_attendees (booking_id, name, email, role, is_optional) VALUES ($1,$2,$3,$4,$5)`, [id, a.name, a.email.toLowerCase(), a.role, a.is_optional]);
      await q.query(`INSERT INTO booking_attendees (booking_id, name, email, role) VALUES ($1,$2,$3,'founder')`, [id, `${input.firstName} ${input.surname}`, input.email.toLowerCase()]);
      await op(q, id, 'create_event');
    });
  } catch (e) {
    if (isUnique(e) && input.idempotencyKey) {
      const [prev] = await d.query<Booking>('SELECT * FROM bookings WHERE idempotency_key = $1', [input.idempotencyKey]);
      if (prev) return { booking: prev, token: manageToken(prev.id) };
    }
    throw e;
  }
  const booking = await runCreate(id);
  if (booking.status === 'failed') throw new BookingError('calendar_failed', 'We couldn’t confirm your booking with Google Calendar, so nothing was booked. Please try again in a moment.');
  return { booking, token };
}

function eventDescription(b: Booking) {
  const when = formatSlot(new Date(b.start_at), b.timezone);
  return [
    `SEVCP Office Hours — ${when.date}, ${when.time} (${b.timezone})`,
    '',
    `Founder: ${b.first_name} ${b.surname} <${b.email}>`,
    `Startup: ${b.startup_name}`,
    b.session_notes ? `Session notes: ${b.session_notes}` : null,
    '',
    'Please come prepared with an update on your progress, key challenges, and proposed priorities for the next milestone period.',
    '',
    `Founder — need to cancel or reschedule? ${manageUrl(b.id)}`,
  ].filter((l) => l !== null).join('\n');
}

/**
 * Creates (or finds) the booking's single calendar event and confirms the booking once Google returns it with
 * every snapshot attendee and a Meet link. Safe to call repeatedly: the event ID is fixed, so a retry after a
 * timeout gets 409 and reads the existing event instead of creating a second one.
 */
export async function runCreate(id: string): Promise<Booking> {
  const d = await db();
  const b = (await getBooking(d, id))!;
  if (b.status === 'confirmed' || b.status === 'cancelled') return b;
  const settings = await getSettings(d);
  const people = await bookingAttendees(d, id);
  const expected = people.map((p) => p.email.toLowerCase());
  const [opRow] = await d.query<{ id: string }>(`SELECT id FROM booking_operations WHERE booking_id = $1 AND operation_type = 'create_event' ORDER BY created_at DESC LIMIT 1`, [id]);
  const opId = opRow?.id || (await op(d, id, 'create_event'));
  const cal = calendar();

  let ev: CalEvent | null = null, error = '', retryable = true, attempts = 0;
  for (let i = 0; i < 3 && !ev; i++) {
    attempts++;
    try {
      ev = await cal.insertEvent(settings.calendar_id, {
        id: b.google_event_id, requestId: b.google_event_id,
        summary: `SEVCP Office Hours | ${b.startup_name}`, description: eventDescription(b),
        start: new Date(b.start_at), end: new Date(b.end_at), timeZone: b.timezone,
        attendees: people.map((p) => ({ email: p.email, ...(p.name ? { displayName: p.name } : {}), ...(p.is_optional ? { optional: true } : {}) })),
      });
    } catch (e) {
      if (e instanceof GoogleError && e.status === 409) {
        try {
          ev = await cal.getEvent(settings.calendar_id, b.google_event_id);
          if (ev && ev.status === 'cancelled') ev = await cal.patchEvent(settings.calendar_id, b.google_event_id, { status: 'confirmed', start: new Date(b.start_at), end: new Date(b.end_at), timeZone: b.timezone });
        } catch (e2) { error = (e2 as Error).message; retryable = e2 instanceof GoogleError ? e2.retryable : true; }
        if (!ev && !error) error = 'Event ID exists but could not be read';
        if (ev) break;
      } else {
        error = (e as Error).message;
        retryable = e instanceof GoogleError ? e.retryable : !(e instanceof NotConnectedError);
        if (!retryable) break;
      }
      await sleep(400 * (i + 1));
    }
  }

  if (ev) {
    for (let i = 0; i < 6 && ev.conference === 'pending'; i++) { await sleep(700); ev = (await cal.getEvent(settings.calendar_id, b.google_event_id)) || ev; }
    const missing = expected.filter((e) => !ev!.attendees.includes(e));
    if (missing.length) error = `Calendar event is missing attendees: ${missing.join(', ')}`;
    else if (ev.conference === 'pending') {
      await d.query(`UPDATE booking_operations SET attempt_count = attempt_count + $2, error_message = $3, updated_at = now() WHERE id = $1`, [opId, attempts, 'Google Meet link still pending; reconciliation will confirm']);
      return (await getBooking(d, id))!;
    } else if (!ev.meetUrl) error = 'Google did not generate a Meet link for the event';
    else {
      await d.tx(async (q) => {
        await q.query(`UPDATE bookings SET status = 'confirmed', google_meet_url = $2, updated_at = now() WHERE id = $1`, [id, ev!.meetUrl]);
        await finishOp(q, opId, 'succeeded', attempts);
      });
      return (await getBooking(d, id))!;
    }
  }

  // Failure: release the slot, record why, and queue cleanup of any event Google may have created anyway.
  await d.tx(async (q) => {
    await q.query(`UPDATE bookings SET status = 'failed', updated_at = now() WHERE id = $1`, [id]);
    await q.query(`DELETE FROM reservations WHERE booking_id = $1`, [id]);
    await finishOp(q, opId, 'failed', attempts, error || 'Unknown calendar error');
    if (ev || retryable) await op(q, id, 'cleanup_event');
  });
  return (await getBooking(d, id))!;
}

type Auth = { token?: string | null; admin?: boolean };
async function authorize(q: Q, id: string, auth: Auth) {
  const b = await getBooking(q, id);
  if (!b) throw new BookingError('not_found', 'Booking not found.');
  if (!auth.admin && !tokenMatches(auth.token, b.cancellation_token_hash)) throw new BookingError('forbidden', 'This link is invalid or has expired.');
  return b;
}

export async function cancelBooking(id: string, auth: Auth): Promise<Booking> {
  const d = await db();
  const b = await authorize(d, id, auth);
  if (b.status === 'cancelled') return b;
  if (b.status === 'failed') throw new BookingError('invalid', 'This booking was never confirmed.');
  const settings = await getSettings(d);
  const opId = await op(d, id, 'cancel_event');
  try {
    await calendar().deleteEvent(settings.calendar_id, b.google_event_id); // sendUpdates=all → cancellation to every attendee
  } catch (e) {
    await finishOp(d, opId, 'failed', 1, (e as Error).message);
    throw new BookingError('calendar_failed', 'We couldn’t cancel the calendar event just now, so your booking is still in place. Please try again.');
  }
  await d.tx(async (q) => {
    await q.query(`UPDATE bookings SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = $1`, [id]);
    await q.query(`DELETE FROM reservations WHERE booking_id = $1`, [id]);
    await finishOp(q, opId, 'succeeded', 1);
  });
  return (await getBooking(d, id))!;
}

/** Holds the new slot alongside the old one, moves the same event (same ID, attendees, Meet link), then releases the old slot. */
export async function rescheduleBooking(id: string, auth: Auth, newStart: string): Promise<Booking> {
  const d = await db();
  const b = await authorize(d, id, auth);
  if (b.status !== 'confirmed') throw new BookingError('invalid', 'Only confirmed bookings can be rescheduled.');
  const { settings, slot } = await resolveSlot(d, newStart);
  if (slot.start.getTime() === new Date(b.start_at).getTime()) return b;

  const av = await availability(d, slot.day, slot.day, { ignoreBookingId: id, ignoreBusy: { start: new Date(b.start_at), end: new Date(b.end_at) } });
  if (!av.ok) throw new BookingError('unverified', av.message);
  if (!av.slots.some((s) => s.start.getTime() === slot.start.getTime())) throw new BookingError('slot_unavailable', 'That time isn’t available any more. Please choose another slot.');

  let opId = '';
  await d.tx(async (q) => {
    await hold(q, id, slot.start, slot.end, slot.day, 'reschedule', settings.buffer_minutes, settings.maximum_bookings_per_day, id);
    opId = await op(q, id, 'reschedule_event', { from: b.start_at, to: slot.start });
  });
  const updated = { ...b, start_at: slot.start, end_at: slot.end };
  try {
    const ev = await calendar().patchEvent(settings.calendar_id, b.google_event_id, { start: slot.start, end: slot.end, timeZone: b.timezone, description: eventDescription(updated) });
    if (ev.start.getTime() !== slot.start.getTime()) throw new Error('Google did not apply the new time');
  } catch (e) {
    await d.tx(async (q) => {
      await q.query(`DELETE FROM reservations WHERE booking_id = $1 AND kind = 'reschedule'`, [id]);
      await finishOp(q, opId, 'failed', 1, (e as Error).message);
    });
    throw new BookingError('calendar_failed', 'We couldn’t move the calendar event, so your original appointment is unchanged. Please try again.');
  }
  await d.tx(async (q) => {
    await q.query(`DELETE FROM reservations WHERE booking_id = $1 AND kind = 'booking'`, [id]);
    await q.query(`UPDATE reservations SET kind = 'booking' WHERE booking_id = $1 AND kind = 'reschedule'`, [id]);
    await q.query(`UPDATE bookings SET start_at = $2, end_at = $3, updated_at = now() WHERE id = $1`, [id, slot.start, slot.end]);
    await finishOp(q, opId, 'succeeded', 1);
  });
  return (await getBooking(d, id))!;
}

/** Admin: retry a failed booking (re-holds its original slot, reuses its event ID). */
export async function retryBooking(id: string): Promise<Booking> {
  const d = await db();
  const b = await getBooking(d, id);
  if (!b) throw new BookingError('not_found', 'Booking not found.');
  if (b.status !== 'failed') return b;
  if (new Date(b.start_at) <= new Date()) throw new BookingError('invalid', 'This slot is in the past.');
  const settings = await getSettings(d);
  await d.tx(async (q) => {
    await hold(q, id, new Date(b.start_at), new Date(b.end_at), dayKey(new Date(b.start_at), b.timezone), 'booking', settings.buffer_minutes, settings.maximum_bookings_per_day);
    await q.query(`UPDATE bookings SET status = 'pending', updated_at = now() WHERE id = $1`, [id]);
    await q.query(`UPDATE booking_operations SET status = 'succeeded', error_message = coalesce(error_message, '') || ' (superseded by retry)' WHERE booking_id = $1 AND operation_type = 'cleanup_event' AND status <> 'succeeded'`, [id]);
    await op(q, id, 'create_event');
  });
  return runCreate(id);
}

/**
 * Recovery pass (cron + admin button): finishes interrupted creates, and removes calendar events that exist
 * for bookings we told the founder had failed.
 */
export async function reconcile(): Promise<{ confirmed: number; failed: number; cleaned: number }> {
  const d = await db();
  const out = { confirmed: 0, failed: 0, cleaned: 0 };
  const pending = await d.query<{ id: string; start_at: Date }>(`SELECT id, start_at FROM bookings WHERE status = 'pending' AND updated_at < now() - interval '2 minutes'`);
  for (const p of pending) {
    const r = await runCreate(p.id);
    if (r.status === 'confirmed') out.confirmed++; else if (r.status === 'failed') out.failed++;
  }
  const settings = await getSettings(d);
  const cleanups = await d.query<{ id: string; booking_id: string; google_event_id: string; status: string }>(
    `SELECT o.id, o.booking_id, b.google_event_id, b.status FROM booking_operations o JOIN bookings b ON b.id = o.booking_id
     WHERE o.operation_type = 'cleanup_event' AND o.status <> 'succeeded' AND o.attempt_count < 8`);
  for (const c of cleanups) {
    if (c.status !== 'failed') { await finishOp(d, c.id, 'succeeded', 0, 'Booking no longer failed; nothing to clean up'); continue; }
    try {
      const ev = await calendar().getEvent(settings.calendar_id, c.google_event_id);
      if (ev && ev.status !== 'cancelled') { await calendar().deleteEvent(settings.calendar_id, c.google_event_id); out.cleaned++; }
      await finishOp(d, c.id, 'succeeded', 1);
    } catch (e) { await finishOp(d, c.id, 'failed', 1, (e as Error).message); }
  }
  return out;
}

/** Cheap guard used on public traffic: run reconcile only when something is actually stuck (throttled per instance). */
let lastCheck = 0;
export async function reconcileIfNeeded() {
  if (Date.now() - lastCheck < 60_000) return;
  lastCheck = Date.now();
  const [r] = await (await db()).query<{ n: number }>(`SELECT
    (SELECT count(*) FROM bookings WHERE status = 'pending' AND updated_at < now() - interval '2 minutes') +
    (SELECT count(*) FROM booking_operations WHERE operation_type = 'cleanup_event' AND status <> 'succeeded' AND attempt_count < 8) AS n`);
  if (Number(r.n) > 0) await reconcile().catch((e) => console.error('[office-hours] reconcile:', (e as Error).message));
}
