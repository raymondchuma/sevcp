import { DateTime } from 'luxon';
import { db, resetDbForTests } from '@/lib/db';
import { resetMock } from '@/lib/google/mock';

export const TZ = 'Africa/Lagos';
// Test attendees (mirrors the production shape: host, one required guest, one optional guest).
export const HOST = 'host@sevcp.test', CO1 = 'required@sevcp.test', CO2 = 'optional@sevcp.test';
export const OFFICE_CAL = 'mock-sevcp-office-hours@group.calendar.google.com';

export async function freshEnv() {
  process.env.OFFICE_HOURS_ATTENDEES = JSON.stringify([
    { name: 'South East Development Commission', email: HOST, role: 'host' },
    { name: 'Required Guest', email: CO1, role: 'cohost' },
    { name: 'Optional Guest', email: CO2, role: 'cohost', optional: true },
  ]);
  process.env.PGLITE_DIR = 'memory';
  process.env.GOOGLE_MODE = 'mock';
  resetDbForTests(); resetMock();
  const d = await db();   // attendees are synced from lib/config.ts on startup
  await d.query(`UPDATE settings SET calendar_id = $1 WHERE id = 1`, [OFFICE_CAL]);
  return d;
}
/** A weekday at least a week out, at HH:mm Lagos time. */
export function slotAt(hhmm: string, plusDays = 7) {
  let d = DateTime.now().setZone(TZ).plus({ days: plusDays }).startOf('day');
  while (d.weekday > 5) d = d.plus({ days: 1 });
  const [h, m] = hhmm.split(':').map(Number);
  const start = d.set({ hour: h, minute: m });
  return { start: start.toJSDate(), end: start.plus({ minutes: 30 }).toJSDate(), day: start.toISODate()!, iso: start.toUTC().toISO()! };
}
export const founder = (n = 1, startIso: string) => ({ firstName: `Founder${n}`, surname: 'Okafor', email: `founder${n}@startup.test`, startupName: `Startup ${n}`, notes: 'Milestone review', start: startIso });
