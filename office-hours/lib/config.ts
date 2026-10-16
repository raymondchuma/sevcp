/**
 * Who is invited to every SEVCP Office Hours session. Fixed configuration — hosts and guests never sign in.
 * The list lives in the OFFICE_HOURS_ATTENDEES environment variable (set in Vercel) rather than in this public
 * repository, so personal email addresses aren't published. Format (JSON array):
 *
 *   [{"name":"South East Development Commission","email":"…","role":"host"},
 *    {"name":"…","email":"…","role":"cohost"},
 *    {"name":"…","email":"…","role":"cohost","optional":true}]
 *
 * - Required attendees must be free for a slot to be offered (their Google free/busy must be readable by the
 *   connected SEDC account — share "See only free/busy" with it).
 * - Optional attendees are invited as optional guests and never block availability.
 * Changes apply to new bookings after a redeploy; existing bookings keep their original invitees.
 */
export interface ConfiguredAttendee { name: string; email: string; role: 'host' | 'cohost'; optional: boolean }

export function configuredAttendees(): ConfiguredAttendee[] {
  const raw = process.env.OFFICE_HOURS_ATTENDEES;
  if (!raw) return [];
  let list: unknown;
  try { list = JSON.parse(raw); } catch { throw new Error('OFFICE_HOURS_ATTENDEES is not valid JSON'); }
  if (!Array.isArray(list)) throw new Error('OFFICE_HOURS_ATTENDEES must be a JSON array');
  const out = list.map((a: Record<string, unknown>) => ({
    name: String(a.name || '').trim(), email: String(a.email || '').trim().toLowerCase(),
    role: a.role === 'host' ? 'host' : 'cohost', optional: a.optional === true,
  }) as ConfiguredAttendee);
  if (out.some((a) => !a.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email))) throw new Error('OFFICE_HOURS_ATTENDEES: every entry needs a name and a valid email');
  if (out.filter((a) => a.role === 'host').length !== 1) throw new Error('OFFICE_HOURS_ATTENDEES: exactly one entry must have "role":"host"');
  if (out.find((a) => a.role === 'host')!.optional) throw new Error('OFFICE_HOURS_ATTENDEES: the host cannot be optional');
  return out;
}

/** Events are created on this calendar inside the connected SEDC Google account (matched by name after connecting). */
export const CALENDAR_NAME = 'SEVCP Office Hours';
