'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from './auth';
import { db } from './db';
import { calendar, NotConnectedError } from './google';
import { calendarMode } from './google';
import { cancelBooking, reconcile, rescheduleBooking, retryBooking, BookingError } from './booking';
import { getActiveAttendees, getSettings } from './settings';

type Result = { ok: boolean; message: string };
const done = (message: string): Result => { revalidatePath('/admin'); return { ok: true, message }; };
const fail = (e: unknown): Result => ({ ok: false, message: e instanceof BookingError || e instanceof Error ? e.message : 'Something went wrong' });

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export async function saveSettings(_: unknown, fd: FormData): Promise<Result> {
  await requireAdmin();
  try {
    const n = (k: string) => Number(fd.get(k));
    const rules: Record<string, [string, string][]> = {};
    for (const d of DAYS) {
      if (fd.get(`${d}_open`) !== 'on') { rules[d] = []; continue; }
      const from = String(fd.get(`${d}_from`)), to = String(fd.get(`${d}_to`));
      if (!HHMM.test(from) || !HHMM.test(to) || from >= to) return { ok: false, message: `Check the hours for ${d.toUpperCase()} (start must be before end).` };
      rules[d] = [[from, to]];
    }
    const s = z.object({
      timezone: z.string().min(3).refine((tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }, 'Unknown time zone'),
      calendar_id: z.string().min(1).max(200),
      duration: z.number().int().min(10).max(240),
      notice: z.number().int().min(0).max(720),
      maxDays: z.number().int().min(1).max(365),
      perDay: z.number().int().min(1).max(50),
      buffer: z.number().int().min(0).max(120),
    }).parse({ timezone: String(fd.get('timezone')), calendar_id: String(fd.get('calendar_id')), duration: n('duration'), notice: n('notice'), maxDays: n('maxDays'), perDay: n('perDay'), buffer: n('buffer') });
    await (await db()).query(`UPDATE settings SET timezone=$1, calendar_id=$2, appointment_duration_minutes=$3, minimum_notice_hours=$4, maximum_booking_days=$5, maximum_bookings_per_day=$6, buffer_minutes=$7, availability_rules=$8, updated_at=now() WHERE id=1`,
      [s.timezone, s.calendar_id, s.duration, s.notice, s.maxDays, s.perDay, s.buffer, JSON.stringify(rules)]);
    return done('Scheduling rules saved.');
  } catch (e) { return fail(e instanceof z.ZodError ? new Error(e.issues[0]?.message) : e); }
}

export async function listCalendars(): Promise<Result & { calendars?: { id: string; summary: string; primary: boolean }[] }> {
  await requireAdmin();
  try { return { ok: true, message: '', calendars: (await calendar().listCalendars()).filter((c) => c.writable) }; }
  catch (e) { return { ok: false, message: e instanceof NotConnectedError ? e.message : `Couldn’t list calendars: ${(e as Error).message}` }; }
}
export async function setBookingCalendar(id: string): Promise<Result> {
  await requireAdmin();
  if (!id || id.length > 300) return { ok: false, message: 'Pick a calendar.' };
  await (await db()).query(`UPDATE settings SET calendar_id = $1, updated_at = now() WHERE id = 1`, [id]);
  return done('Booking calendar updated. New bookings are created there.');
}

/** Checks the Google connection and that every active attendee's free/busy is readable. */
export async function testAccess(): Promise<Result & { rows?: { name: string; email: string; role: string; ok: boolean; detail: string }[] }> {
  await requireAdmin();
  const d = await db();
  try {
    const people = await getActiveAttendees(d);
    const s = await getSettings(d);
    const now = new Date();
    const checks = [
      ...(s.calendar_id !== 'primary' ? [{ name: 'SEVCP Office Hours calendar', email: s.calendar_id, role: 'booking calendar', optional: false }] : []),
      ...people.map((p) => ({ name: p.name, email: p.email, role: p.role === 'host' ? 'host' : 'guest', optional: p.is_optional })),
    ];
    const fb = await calendar().freeBusy(checks.map((p) => p.email), now, new Date(now.getTime() + 7 * 864e5), s.timezone);
    const rows = checks.map((p) => {
      const r = fb[p.email];
      const okRead = !!r && !('error' in r);
      return { name: p.name, email: p.email, role: p.optional ? `${p.role}, optional` : p.role, ok: okRead || p.optional,
        detail: okRead ? `OK · ${(r as { busy: unknown[] }).busy.length} busy block(s) in the next 7 days` : p.optional ? 'Not readable — fine, optional guests don’t affect availability' : `Can’t read free/busy (${r && 'error' in r ? r.error : 'no response'})` };
    });
    for (const r of rows) if (r.ok) await d.query(`UPDATE integration_events SET resolved = true WHERE kind = 'calendar_access' AND subject = $1`, [r.email]);
    if (rows.every((r) => r.ok)) await d.query(`UPDATE integration_events SET resolved = true WHERE kind = 'freebusy_failed'`);
    revalidatePath('/admin');
    const bad = rows.filter((r) => !r.ok).length;
    return { ok: bad === 0, message: bad ? `${bad} calendar(s) can’t be read — booking stays paused until fixed.` : `All ${rows.length} calendars readable (${calendarMode()} mode).`, rows };
  } catch (e) { return { ok: false, message: e instanceof NotConnectedError ? e.message : `Calendar check failed: ${(e as Error).message}` }; }
}

export async function resolveEvent(id: string) { await requireAdmin(); await (await db()).query(`UPDATE integration_events SET resolved = true WHERE id = $1`, [id]); return done('Marked resolved.'); }
export async function retry(id: string): Promise<Result> { await requireAdmin(); try { const b = await retryBooking(id); return b.status === 'confirmed' ? done('Booking confirmed and invitations sent.') : { ok: false, message: `Still ${b.status} — see the error log.` }; } catch (e) { return fail(e); } }
export async function runRecovery(): Promise<Result> { await requireAdmin(); try { const r = await reconcile(); return done(`Recovery ran: ${r.confirmed} confirmed, ${r.failed} failed, ${r.cleaned} stray event(s) removed.`); } catch (e) { return fail(e); } }
export async function adminCancel(id: string): Promise<Result> { await requireAdmin(); try { await cancelBooking(id, { admin: true }); return done('Booking cancelled; attendees notified.'); } catch (e) { return fail(e); } }
export async function adminReschedule(id: string, start: string): Promise<Result> { await requireAdmin(); try { await rescheduleBooking(id, { admin: true }, start); return done('Booking rescheduled; attendees notified.'); } catch (e) { return fail(e); } }
export async function disconnectGoogle(): Promise<Result> { await requireAdmin(); await (await db()).query(`DELETE FROM google_credentials WHERE id = 1`); return done('Google Calendar disconnected. Booking is paused until it is reconnected.'); }
