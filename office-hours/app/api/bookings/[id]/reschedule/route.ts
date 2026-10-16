import { NextRequest, NextResponse } from 'next/server';
import { rescheduleBooking } from '@/lib/booking';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { errorResponse, tooMany } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await rateLimit(clientIp(req.headers), 'manage', 20, 3600))) return tooMany();
    const { id } = await params;
    const { token, start } = (await req.json().catch(() => ({}))) as { token?: string; start?: string };
    const b = await rescheduleBooking(id, { token }, String(start || ''));
    return NextResponse.json({ status: b.status, start: b.start_at });
  } catch (e) { return errorResponse(e); }
}
