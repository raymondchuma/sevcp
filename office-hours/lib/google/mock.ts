import { CalendarProvider, CalEvent, EventInput, GoogleError } from './types';

/**
 * In-memory stand-in for Google Calendar (local dev + automated tests). Behaves like the real API where
 * it matters: event IDs are unique forever (re-inserting a deleted ID → 409), invited attendees show as
 * busy, unknown/unshared calendars return free/busy errors, and failures can be injected.
 */
interface MockEvent extends CalEvent { calendarId: string; summary: string; description: string; timeZone: string; optional: string[] }
export interface MockState {
  events: Map<string, MockEvent>;
  busy: Map<string, { start: Date; end: Date }[]>;     // external commitments per email
  inaccessible: Set<string>;                             // free/busy → error for these emails
  failNext: { insert?: number; patch?: number; delete?: number; freeBusy?: number };
  conferencePendingReads: number;                        // getEvent returns 'pending' this many times
  notifications: { type: 'invite' | 'update' | 'cancel'; eventId: string; to: string[] }[];
  /** Simulates a timeout after Google already created the event. */
  insertSucceedsThenErrors: boolean;
}
const g = globalThis as unknown as { __ohMock?: MockState };
export function mockState(): MockState {
  if (!g.__ohMock) g.__ohMock = { events: new Map(), busy: new Map(), inaccessible: new Set(), failNext: {}, conferencePendingReads: 0, notifications: [], insertSucceedsThenErrors: false };
  return g.__ohMock;
}
export function resetMock() { g.__ohMock = undefined; }

const injected = (k: keyof MockState['failNext']) => {
  const s = mockState(); const status = s.failNext[k];
  if (status) { delete s.failNext[k]; throw new GoogleError(`Mock Google ${k} failure (${status})`, status, status >= 500 || status === 0); }
};
const view = (e: MockEvent): CalEvent => ({ id: e.id, status: e.status, start: e.start, end: e.end, attendees: [...e.attendees], meetUrl: e.meetUrl, conference: e.conference });

export const mockProvider: CalendarProvider = {
  mode: 'mock',
  async freeBusy(emails, timeMin, timeMax) {
    injected('freeBusy');
    const s = mockState(); const out: Record<string, any> = {};
    for (const raw of emails) {
      const email = raw.toLowerCase();
      if (s.inaccessible.has(email)) { out[raw] = { error: 'notFound' }; continue; }
      const busy = [...(s.busy.get(email) || [])];
      for (const e of s.events.values()) if (e.status !== 'cancelled' && (e.attendees.includes(email) || e.calendarId === raw)) busy.push({ start: e.start, end: e.end });
      out[raw] = { busy: busy.filter((b) => b.start < timeMax && b.end > timeMin) };
    }
    return out;
  },
  async insertEvent(calendarId, ev: EventInput) {
    injected('insert');
    const s = mockState();
    if (s.events.has(ev.id)) throw new GoogleError('The requested identifier already exists.', 409, false);
    const e: MockEvent = {
      id: ev.id, calendarId, summary: ev.summary, description: ev.description, timeZone: ev.timeZone, status: 'confirmed',
      start: ev.start, end: ev.end, attendees: ev.attendees.map((a) => a.email.toLowerCase()), optional: ev.attendees.filter((a) => a.optional).map((a) => a.email.toLowerCase()),
      meetUrl: `https://meet.google.com/mock-${ev.id.slice(-10)}`, conference: 'success',
    };
    s.events.set(ev.id, e);
    s.notifications.push({ type: 'invite', eventId: ev.id, to: [...e.attendees] });
    if (s.insertSucceedsThenErrors) { s.insertSucceedsThenErrors = false; throw new GoogleError('Mock timeout after create', 0, true); }
    return view(e);
  },
  async getEvent(_cal, id) {
    const s = mockState(); const e = s.events.get(id);
    if (!e) return null;
    if (s.conferencePendingReads > 0 && e.status !== 'cancelled') { s.conferencePendingReads--; return { ...view(e), meetUrl: null, conference: 'pending' }; }
    return view(e);
  },
  async patchEvent(_cal, id, p) {
    injected('patch');
    const s = mockState(); const e = s.events.get(id);
    if (!e) throw new GoogleError('Not Found', 404, false);
    if (p.start) e.start = p.start;
    if (p.end) e.end = p.end;
    if (p.status) e.status = p.status;
    if (p.description !== undefined) e.description = p.description;
    s.notifications.push({ type: 'update', eventId: id, to: [...e.attendees] });
    return view(e);
  },
  async listCalendars() {
    return [{ id: 'primary', summary: 'South East Development Commission', primary: true, writable: true }, { id: 'mock-sevcp-office-hours@group.calendar.google.com', summary: 'SEVCP Office Hours', primary: false, writable: true }];
  },
  async deleteEvent(_cal, id) {
    injected('delete');
    const s = mockState(); const e = s.events.get(id);
    if (!e || e.status === 'cancelled') return;
    e.status = 'cancelled';   // Google keeps deleted events (status=cancelled); the ID stays taken
    s.notifications.push({ type: 'cancel', eventId: id, to: [...e.attendees] });
  },
};
