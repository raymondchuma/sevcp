import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { availability } from '@/lib/availability';
import { reconcileIfNeeded } from '@/lib/booking';
import { bookingWindow, dayKey, formatSlot } from '@/lib/time';
import { getSettings } from '@/lib/settings';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { errorResponse, tooMany } from '@/lib/http';

export const dynamic = 'force-dynamic';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    if (!(await rateLimit(clientIp(req.headers), 'availability', 120, 60))) return tooMany();
    const from = req.nextUrl.searchParams.get('from') || '', to = req.nextUrl.searchParams.get('to') || '';
    if (!DAY.test(from) || !DAY.test(to)) return NextResponse.json({ error: 'invalid', message: 'from/to must be YYYY-MM-DD' }, { status: 400 });
    const ignore = req.nextUrl.searchParams.get('ignore') || undefined;   // the booking being rescheduled
    const d = await db();
    await reconcileIfNeeded();
    const s = await getSettings(d);
    const win = bookingWindow(s);
    const av = await availability(d, from, to, ignore ? { ignoreBookingId: ignore } : {});
    const base = { timezone: s.timezone, duration: s.appointment_duration_minutes, firstDay: dayKey(win.earliest, s.timezone), lastDay: dayKey(new Date(win.latest.getTime() - 1), s.timezone) };
    if (!av.ok) return NextResponse.json({ ...base, ok: false, reason: av.reason, message: av.message, days: {} });
    const days: Record<string, { start: string; label: string }[]> = {};
    for (const sl of av.slots) (days[sl.day] ||= []).push({ start: sl.start.toISOString(), label: formatSlot(sl.start, s.timezone).time });
    return NextResponse.json({ ...base, ok: true, days }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
