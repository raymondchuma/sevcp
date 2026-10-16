import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sign, verify } from './crypto';

const COOKIE = 'oh_admin';
export const adminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
/** Local convenience only: no Google client configured and not on Vercel. */
export const devLoginAllowed = () => !process.env.GOOGLE_CLIENT_ID && !process.env.VERCEL;

export async function getAdmin(): Promise<{ email: string } | null> {
  const s = verify<{ email: string; exp: number }>((await cookies()).get(COOKIE)?.value);
  if (!s) return null;
  // Re-check the allowlist on every request so removing an email revokes access immediately.
  if (s.email === 'dev@localhost' ? !devLoginAllowed() : !adminEmails().includes(s.email)) return null;
  return { email: s.email };
}
export async function requireAdmin() {
  const a = await getAdmin();
  if (!a) redirect('/admin/login');
  return a;
}
export async function setAdminSession(email: string) {
  (await cookies()).set(COOKIE, sign({ email, exp: Date.now() + 12 * 3600e3 }), { httpOnly: true, secure: !!process.env.VERCEL, sameSite: 'lax', path: '/office-hours', maxAge: 12 * 3600 });
}
export async function clearAdminSession() { (await cookies()).delete({ name: COOKIE, path: '/office-hours' }); }
