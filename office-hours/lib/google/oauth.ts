import 'server-only';

export const CALENDAR_SCOPES = [
  'openid', 'email',
  'https://www.googleapis.com/auth/calendar.events',     // create/update/cancel events (+ invitations)
  'https://www.googleapis.com/auth/calendar.freebusy',   // free/busy for host + required guests
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly', // find the "SEVCP Office Hours" calendar
];
export const LOGIN_SCOPES = ['openid', 'email', 'profile'];

export const baseUrl = () => (process.env.PUBLIC_BASE_URL || 'http://localhost:4620').replace(/\/$/, '');
export const redirectUri = () => `${baseUrl()}/office-hours/api/auth/google/callback`;

export function authUrl(purpose: 'login' | 'calendar', state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '', redirect_uri: redirectUri(), response_type: 'code', state,
    scope: (purpose === 'calendar' ? CALENDAR_SCOPES : LOGIN_SCOPES).join(' '),
  });
  if (purpose === 'calendar') { p.set('access_type', 'offline'); p.set('prompt', 'consent'); p.set('include_granted_scopes', 'true'); }
  else p.set('prompt', 'select_account');
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** Exchanges the code. The id_token comes straight from Google's token endpoint over TLS, so its claims can be trusted (OIDC §3.1.3.7). */
export async function exchangeCode(code: string) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', redirect_uri: redirectUri(), grant_type: 'authorization_code' }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google sign-in failed: ${j.error_description || j.error || r.status}`);
  const claims = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString());
  return { refreshToken: j.refresh_token as string | undefined, scope: j.scope as string, email: String(claims.email || '').toLowerCase(), emailVerified: !!claims.email_verified, name: claims.name as string | undefined };
}
