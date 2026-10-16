import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getBooking } from '@/lib/booking';
import { tokenMatches } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/** Status poll for the confirmation page (token-gated; returns no personal data). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBooking(await db(), id);
  if (!b || !tokenMatches(req.nextUrl.searchParams.get('t'), b.cancellation_token_hash)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ status: b.status });
}
