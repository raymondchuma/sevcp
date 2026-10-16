import { NextRequest, NextResponse } from 'next/server';
import { reconcile } from '@/lib/booking';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Vercel Cron (see vercel.json) — sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await reconcile());
}
