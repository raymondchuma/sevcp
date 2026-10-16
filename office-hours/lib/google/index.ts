import 'server-only';
import { CalendarProvider } from './types';
import { mockProvider } from './mock';
import { liveProvider } from './live';

export * from './types';

/**
 * GOOGLE_MODE=live|mock. Defaults to live when a Google OAuth client is configured, otherwise mock.
 * Production never silently falls back to the mock.
 */
export function calendarMode(): 'live' | 'mock' {
  const m = process.env.GOOGLE_MODE;
  if (m === 'live' || m === 'mock') return m;
  if (process.env.GOOGLE_CLIENT_ID) return 'live';
  if (process.env.VERCEL_ENV === 'production') throw new Error('GOOGLE_CLIENT_ID is not set (set GOOGLE_MODE=mock to demo without Google)');
  return 'mock';
}
export const calendar = (): CalendarProvider => (calendarMode() === 'live' ? liveProvider : mockProvider);
