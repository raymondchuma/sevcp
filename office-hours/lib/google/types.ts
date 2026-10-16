export interface Busy { start: Date; end: Date }
export type FreeBusyResult = Record<string, { busy: Busy[] } | { error: string }>;

export interface EventInput {
  id: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendees: { email: string; displayName?: string; optional?: boolean }[];
  requestId: string; // conference createRequest id
}
export interface CalEvent {
  id: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  start: Date;
  end: Date;
  attendees: string[];               // lower-cased emails
  meetUrl: string | null;
  conference: 'success' | 'pending' | 'failure' | 'none';
  htmlLink?: string;
}

export class GoogleError extends Error {
  constructor(message: string, public status: number, public retryable: boolean) { super(message); }
}
export class NotConnectedError extends Error {}

export interface CalendarProvider {
  mode: 'mock' | 'live';
  freeBusy(emails: string[], timeMin: Date, timeMax: Date, timeZone: string): Promise<FreeBusyResult>;
  insertEvent(calendarId: string, ev: EventInput): Promise<CalEvent>;
  getEvent(calendarId: string, id: string): Promise<CalEvent | null>;
  patchEvent(calendarId: string, id: string, patch: { start?: Date; end?: Date; timeZone?: string; status?: 'confirmed'; description?: string }): Promise<CalEvent>;
  deleteEvent(calendarId: string, id: string): Promise<void>;
  listCalendars(): Promise<{ id: string; summary: string; primary: boolean; writable: boolean }[]>;
}
