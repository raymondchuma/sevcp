import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking } from '@/lib/booking';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { errorResponse, tooMany } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await rateLimit(clientIp(req.headers), 'manage', 20, 3600))) return tooMany();
    const { id } = await params;
    const { token } = (await req.json().catch(() => ({}))) as { token?: string };
    const b = await cancelBooking(id, { token });
    return NextResponse.json({ status: b.status });
  } catch (e) { return errorResponse(e); }
}
