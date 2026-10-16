import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authUrl } from '@/lib/google/oauth';
import { randomToken, sign } from '@/lib/crypto';
import { getAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const purpose = req.nextUrl.searchParams.get('purpose') === 'calendar' ? 'calendar' : 'login';
  if (!process.env.GOOGLE_CLIENT_ID) return NextResponse.json({ error: 'GOOGLE_CLIENT_ID is not configured' }, { status: 500 });
  if (purpose === 'calendar' && !(await getAdmin())) return NextResponse.redirect(new URL('/office-hours/admin/login', req.url));
  const nonce = randomToken(16);
  (await cookies()).set('oh_oauth', sign({ nonce, purpose, exp: Date.now() + 10 * 60e3 }), { httpOnly: true, secure: !!process.env.VERCEL, sameSite: 'lax', path: '/office-hours', maxAge: 600 });
  return NextResponse.redirect(authUrl(purpose, nonce));
}
