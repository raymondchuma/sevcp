import 'server-only';
import { Q } from './db';
import { calendar, NotConnectedError, Busy } from './google';
import { getActiveAttendees, getSettings, logIntegration, Attendee } from './settings';
import { addMinutes, candidateSlots, overlaps, Settings, Slot } from './time';

export type AvailabilityResult =
  | { ok: true; settings: Settings; attendees: Attendee[]; slots: Slot[] }
  | { ok: false; reason: 'not_configured' | 'unverified'; message: string };

/**
 * Bookable slots for local days [fromDay, toDay]. A slot is offered only if it satisfies the rules, isn't held
 * in our database, keeps the day under its cap, and is free on the office-hours calendar, the host's calendar and
 * every REQUIRED guest's calendar (optional guests never block).
 * If any required calendar can't be read we fail closed (offer nothing) and log an admin-facing error.
 */
export async function availability(q: Q, fromDay: string, toDay: string, opts: { ignoreBookingId?: string; ignoreBusy?: Busy } = {}): Promise<AvailabilityResult> {
  const settings = await getSettings(q);
  const attendees = await getActiveAttendees(q);
  if (!attendees.some((a) => a.role === 'host')) return { ok: false, reason: 'not_configured', message: 'Office hours are not set up yet (no host configured).' };

  const cands = candidateSlots(settings, fromDay, toDay);
  if (!cands.length) return { ok: true, settings, attendees, slots: [] };
  const buf = settings.buffer_minutes;
  const tMin = addMinutes(cands[0].start, -buf), tMax = addMinutes(cands[cands.length - 1].end, buf);

  const required = attendees.filter((a) => !a.is_optional);
  // Also check the booking calendar itself, so anything placed directly on "SEVCP Office Hours" blocks the slot.
  const sources = [...required.map((a) => ({ id: a.email, label: `${a.role === 'host' ? 'the host' : 'required guest'} ${a.name} <${a.email}>` })),
    ...(settings.calendar_id && settings.calendar_id !== 'primary' ? [{ id: settings.calendar_id, label: `the booking calendar (${settings.calendar_id})` }] : [])];
  let fb;
  try {
    fb = await calendar().freeBusy(sources.map((x) => x.id), tMin, tMax, settings.timezone);
  } catch (e) {
    const msg = e instanceof NotConnectedError ? e.message : `Could not check calendar availability: ${(e as Error).message}`;
    await logIntegration(q, 'freebusy_failed', null, msg);
    return { ok: false, reason: 'unverified', message: 'Availability can’t be verified right now. Please try again shortly.' };
  }
  const busy: Busy[] = [];
  for (const src of sources) {
    const r = fb[src.id];
    if (!r || 'error' in r) {
      await logIntegration(q, 'calendar_access', src.id,
        `Can't read the free/busy of ${src.label} (${r ? r.error : 'missing'}). ` +
        `Share that Google Calendar's free/busy ("See only free/busy (hide details)") with the connected SEDC account, then run "Test calendar access". Booking is paused until then.`);
      return { ok: false, reason: 'unverified', message: 'Availability can’t be verified right now. Please try again shortly.' };
    }
    for (const b of r.busy) if (!(opts.ignoreBusy && b.start.getTime() === opts.ignoreBusy.start.getTime() && b.end.getTime() === opts.ignoreBusy.end.getTime())) busy.push(b);
  }

  const held = await q.query<{ booking_id: string; lo: Date; hi: Date; local_day: string; kind: string }>(
    `SELECT booking_id, lower(slot) AS lo, upper(slot) AS hi, to_char(local_day, 'YYYY-MM-DD') AS local_day, kind FROM reservations
     WHERE slot && tstzrange($1, $2)`, [tMin, addMinutes(tMax, buf)]);
  const perDay = new Map<string, number>();
  for (const h of held) if (h.kind === 'booking' && h.booking_id !== opts.ignoreBookingId) perDay.set(h.local_day, (perDay.get(h.local_day) || 0) + 1);

  const slots = cands.filter((c) => {
    if ((perDay.get(c.day) || 0) >= settings.maximum_bookings_per_day) return false;
    const hiOurs = addMinutes(c.end, buf);
    if (held.some((h) => h.booking_id !== opts.ignoreBookingId && overlaps(c.start, hiOurs, new Date(h.lo), new Date(h.hi)))) return false;
    const lo = addMinutes(c.start, -buf);
    return !busy.some((b) => overlaps(lo, hiOurs, b.start, b.end));
  });
  return { ok: true, settings, attendees, slots };
}
