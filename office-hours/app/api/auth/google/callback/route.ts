import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode, baseUrl } from '@/lib/google/oauth';
import { encrypt, verify } from '@/lib/crypto';
import { adminEmails, getAdmin, setAdminSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { calendar } from '@/lib/google';
import { CALENDAR_NAME } from '@/lib/config';

const back = (path: string) => NextResponse.redirect(`${baseUrl()}/office-hours${path}`);

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const st = verify<{ nonce: string; purpose: 'login' | 'calendar'; exp: number }>(jar.get('oh_oauth')?.value);
  jar.delete({ name: 'oh_oauth', path: '/office-hours' });
  const code = req.nextUrl.searchParams.get('code');
  if (!st || st.nonce !== req.nextUrl.searchParams.get('state') || !code) return back('/admin/login?error=state');
  try {
    const r = await exchangeCode(code);
    if (st.purpose === 'login') {
      if (!r.emailVerified || !adminEmails().includes(r.email)) return back('/admin/login?error=not_allowed');
      await setAdminSession(r.email);
      return back('/admin');
    }
    if (!(await getAdmin())) return back('/admin/login');
    if (!r.refreshToken) return back('/admin?error=no_refresh_token');
    const granted = r.scope.split(' ');
    if (!granted.includes('https://www.googleapis.com/auth/calendar.events') || !granted.includes('https://www.googleapis.com/auth/calendar.freebusy')) return back('/admin?error=scopes');
    await (await db()).query(
      `INSERT INTO google_credentials (id, account_email, refresh_token_encrypted, scopes) VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET account_email = EXCLUDED.account_email, refresh_token_encrypted = EXCLUDED.refresh_token_encrypted, scopes = EXCLUDED.scopes, connected_at = now()`,
      [r.email, encrypt(r.refreshToken), r.scope]);
    // Point bookings at the "SEVCP Office Hours" calendar automatically when it exists.
    try {
      const cals = await calendar().listCalendars();
      const match = cals.find((c) => c.writable && c.summary.trim().toLowerCase() === CALENDAR_NAME.toLowerCase());
      if (match) { await (await db()).query(`UPDATE settings SET calendar_id = $1, updated_at = now() WHERE id = 1`, [match.id]); return back('/admin?connected=1'); }
      return back('/admin?connected=1&calendar=missing');
    } catch { return back('/admin?connected=1&calendar=missing'); }
  } catch (e) {
    console.error('[office-hours] oauth callback:', (e as Error).message);
    return back(`/admin${st.purpose === 'login' ? '/login' : ''}?error=oauth`);
  }
}
