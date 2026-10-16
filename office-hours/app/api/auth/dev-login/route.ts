import { NextResponse } from 'next/server';
import { devLoginAllowed, setAdminSession } from '@/lib/auth';
import { baseUrl } from '@/lib/google/oauth';

/** Local development only (no Google client configured, not on Vercel). */
export async function POST() {
  if (!devLoginAllowed()) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await setAdminSession('dev@localhost');
  return NextResponse.redirect(`${baseUrl()}/office-hours/admin`, 303);
}
