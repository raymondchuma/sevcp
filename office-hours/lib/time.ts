import { DateTime } from 'luxon';

export type Rules = Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', [string, string][]>;
export interface Settings {
  host_email: string | null;
  calendar_id: string;
  timezone: string;
  appointment_duration_minutes: number;
  availability_rules: Rules;
  minimum_notice_hours: number;
  maximum_booking_days: number;
  maximum_bookings_per_day: number;
  buffer_minutes: number;
}
export interface Slot { start: Date; end: Date; day: string }

const KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Calendar day (YYYY-MM-DD) of an instant in a time zone. */
export const dayKey = (d: Date, tz: string) => DateTime.fromJSDate(d, { zone: tz }).toISODate()!;

/** First and last bookable instants for "now". */
export function bookingWindow(s: Settings, now = new Date()) {
  const earliest = DateTime.fromJSDate(now).plus({ hours: s.minimum_notice_hours });
  const latest = DateTime.fromJSDate(now, { zone: s.timezone }).startOf('day').plus({ days: s.maximum_booking_days + 1 });
  return { earliest: earliest.toJSDate(), latest: latest.toJSDate() };
}

/**
 * All slots allowed by office hours, notice and window for local days [fromDay, toDay] (inclusive).
 * Slots are aligned to the start of each availability window, stepping by the appointment duration.
 */
export function candidateSlots(s: Settings, fromDay: string, toDay: string, now = new Date()): Slot[] {
  const { earliest, latest } = bookingWindow(s, now);
  const out: Slot[] = [];
  let day = DateTime.fromISO(fromDay, { zone: s.timezone }).startOf('day');
  const last = DateTime.fromISO(toDay, { zone: s.timezone }).startOf('day');
  if (!day.isValid || !last.isValid || last.diff(day, 'days').days > 120) return out;
  for (; day <= last; day = day.plus({ days: 1 })) {
    const windows = s.availability_rules[KEYS[day.weekday - 1]] || [];
    for (const [from, to] of windows) {
      const [fh, fm] = from.split(':').map(Number), [th, tm] = to.split(':').map(Number);
      const wEnd = day.set({ hour: th, minute: tm });
      for (let t = day.set({ hour: fh, minute: fm }); t.plus({ minutes: s.appointment_duration_minutes }) <= wEnd; t = t.plus({ minutes: s.appointment_duration_minutes })) {
        const start = t.toJSDate(), end = t.plus({ minutes: s.appointment_duration_minutes }).toJSDate();
        if (start < earliest || start >= latest) continue;
        out.push({ start, end, day: day.toISODate()! });
      }
    }
  }
  return out;
}

export const overlaps = (a0: Date, a1: Date, b0: Date, b1: Date) => a0 < b1 && b0 < a1;
export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

export function formatSlot(d: Date, tz: string) {
  const t = DateTime.fromJSDate(d, { zone: tz });
  return { date: t.toFormat('cccc d LLLL yyyy'), time: t.toFormat('h:mm a'), short: t.toFormat('ccc d LLL, h:mm a') };
}

/** Human summary of the weekly rules, e.g. "Mon–Fri · 11:00 AM – 3:00 PM". */
export function hoursSummary(rules: Rules): string {
  const names = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' } as const;
  const fmt = (hm: string) => DateTime.fromFormat(hm, 'HH:mm').toFormat('h:mm a');
  const groups: { days: string[]; label: string }[] = [];
  for (const k of KEYS) {
    const w = rules[k] || [];
    const label = w.map(([a, b]) => `${fmt(a)} – ${fmt(b)}`).join(', ');
    const last = groups[groups.length - 1];
    if (label && last && last.label === label && KEYS.indexOf(last.days[last.days.length - 1] as typeof KEYS[number]) === KEYS.indexOf(k) - 1) last.days.push(k);
    else if (label) groups.push({ days: [k], label });
  }
  return groups.map((g) => `${names[g.days[0] as keyof typeof names]}${g.days.length > 1 ? '–' + names[g.days[g.days.length - 1] as keyof typeof names] : ''} · ${g.label}`).join('; ');
}
