import 'server-only';
import { Q } from './db';
import { Settings } from './time';

export interface Attendee { id: string; name: string; email: string; role: 'host' | 'cohost'; is_active: boolean; is_optional: boolean }

export async function getSettings(q: Q): Promise<Settings> {
  const [s] = await q.query<Settings>('SELECT * FROM settings WHERE id = 1');
  return s;
}
/** Active host first, then co-hosts. */
export async function getActiveAttendees(q: Q): Promise<Attendee[]> {
  return q.query<Attendee>(`SELECT * FROM attendees WHERE is_active ORDER BY (role = 'host') DESC, created_at`);
}
export async function logIntegration(q: Q, kind: string, subject: string | null, message: string) {
  // De-duplicate: one open entry per kind+subject per hour.
  const [open] = await q.query(`SELECT 1 FROM integration_events WHERE NOT resolved AND kind = $1 AND subject IS NOT DISTINCT FROM $2 AND created_at > now() - interval '1 hour'`, [kind, subject]);
  if (!open) await q.query('INSERT INTO integration_events (kind, subject, message) VALUES ($1, $2, $3)', [kind, subject, message]);
}
