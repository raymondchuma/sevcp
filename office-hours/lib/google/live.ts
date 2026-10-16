import 'server-only';
import { db } from '../db';
import { decrypt } from '../crypto';
import { CalendarProvider, CalEvent, EventInput, FreeBusyResult, GoogleError, NotConnectedError } from './types';

const API = 'https://www.googleapis.com/calendar/v3';
let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const [cred] = await (await db()).query<{ refresh_token_encrypted: string }>('SELECT refresh_token_encrypted FROM google_credentials WHERE id = 1');
  if (!cred) throw new NotConnectedError('Google Calendar is not connected. An administrator must connect it in the dashboard.');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decrypt(cred.refresh_token_encrypted), grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new NotConnectedError(`Google token refresh failed (${j.error || r.status}). Reconnect Google Calendar in the dashboard.`);
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  let r: Response;
  try {
    r = await fetch(API + path, { ...init, headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  } catch (e) {
    if (e instanceof NotConnectedError) throw e;
    throw new GoogleError(`Network error calling Google Calendar: ${(e as Error).message}`, 0, true);
  }
  if (r.status === 401) cached = null;
  return r;
}
async function fail(r: Response, what: string): Promise<never> {
  let msg = '';
  try { msg = (await r.json()).error?.message || ''; } catch {}
  throw new GoogleError(`${what} failed (${r.status})${msg ? `: ${msg}` : ''}`, r.status, r.status === 429 || r.status >= 500);
}

function toEvent(j: any): CalEvent {
  const video = (j.conferenceData?.entryPoints || []).find((e: any) => e.entryPointType === 'video');
  const code = j.conferenceData?.createRequest?.status?.statusCode;
  return {
    id: j.id, status: j.status,
    start: new Date(j.start?.dateTime || j.start?.date), end: new Date(j.end?.dateTime || j.end?.date),
    attendees: (j.attendees || []).map((a: any) => String(a.email).toLowerCase()),
    meetUrl: video?.uri || j.hangoutLink || null,
    conference: video ? 'success' : code === 'pending' ? 'pending' : code === 'failure' ? 'failure' : 'none',
    htmlLink: j.htmlLink,
  };
}

export const liveProvider: CalendarProvider = {
  mode: 'live',
  async freeBusy(emails, timeMin, timeMax, timeZone) {
    const out: FreeBusyResult = {};
    // Query in ≤ 30-day chunks (Google caps the free/busy range).
    for (let t0 = timeMin; t0 < timeMax;) {
      const t1 = new Date(Math.min(timeMax.getTime(), t0.getTime() + 30 * 864e5));
      const r = await call('/freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: t0.toISOString(), timeMax: t1.toISOString(), timeZone, items: emails.map((id) => ({ id })) }) });
      if (!r.ok) await fail(r, 'Free/busy query');
      const j = await r.json();
      for (const email of emails) {
        const c = j.calendars?.[email];
        if (!c || c.errors?.length) { out[email] = { error: c?.errors?.map((e: any) => e.reason).join(', ') || 'notFound' }; continue; }
        const prev = out[email];
        if (prev && 'error' in prev) continue;
        out[email] = { busy: [...(prev ? prev.busy : []), ...c.busy.map((b: any) => ({ start: new Date(b.start), end: new Date(b.end) }))] };
      }
      t0 = t1;
    }
    return out;
  },
  async insertEvent(calendarId, ev: EventInput) {
    const r = await call(`/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`, {
      method: 'POST',
      body: JSON.stringify({
        id: ev.id, summary: ev.summary, description: ev.description,
        start: { dateTime: ev.start.toISOString(), timeZone: ev.timeZone },
        end: { dateTime: ev.end.toISOString(), timeZone: ev.timeZone },
        attendees: ev.attendees,
        guestsCanInviteOthers: false,
        reminders: { useDefault: true },
        conferenceData: { createRequest: { requestId: ev.requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      }),
    });
    if (!r.ok) await fail(r, 'Creating the calendar event');
    return toEvent(await r.json());
  },
  async getEvent(calendarId, id) {
    const r = await call(`/calendars/${encodeURIComponent(calendarId)}/events/${id}`);
    if (r.status === 404) return null;
    if (!r.ok) await fail(r, 'Reading the calendar event');
    return toEvent(await r.json());
  },
  async patchEvent(calendarId, id, p) {
    const body: any = {};
    if (p.start) body.start = { dateTime: p.start.toISOString(), timeZone: p.timeZone };
    if (p.end) body.end = { dateTime: p.end.toISOString(), timeZone: p.timeZone };
    if (p.status) body.status = p.status;
    if (p.description !== undefined) body.description = p.description;
    const r = await call(`/calendars/${encodeURIComponent(calendarId)}/events/${id}?conferenceDataVersion=1&sendUpdates=all`, { method: 'PATCH', body: JSON.stringify(body) });
    if (!r.ok) await fail(r, 'Updating the calendar event');
    return toEvent(await r.json());
  },
  async listCalendars() {
    const r = await call('/users/me/calendarList?minAccessRole=writer&maxResults=250');
    if (!r.ok) await fail(r, 'Listing calendars');
    const j = await r.json();
    return (j.items || []).map((c: any) => ({ id: c.id, summary: c.summaryOverride || c.summary, primary: !!c.primary, writable: c.accessRole === 'owner' || c.accessRole === 'writer' }));
  },
  async deleteEvent(calendarId, id) {
    const r = await call(`/calendars/${encodeURIComponent(calendarId)}/events/${id}?sendUpdates=all`, { method: 'DELETE' });
    if (r.ok || r.status === 404 || r.status === 410) return;
    await fail(r, 'Cancelling the calendar event');
  },
};
