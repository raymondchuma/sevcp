import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createBooking } from '@/lib/booking';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { errorResponse, tooMany } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  surname: z.string().trim().min(1, 'Surname is required').max(80),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')).refine((v) => v.length <= 200),
  startupName: z.string().trim().min(1, 'Startup name is required').max(120),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  start: z.iso.datetime({ offset: true }),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{8,64}$/).optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!(await rateLimit(clientIp(req.headers), 'book', 12, 3600))) return tooMany();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'invalid', message: parsed.error.issues[0]?.message || 'Check the form and try again.', field: parsed.error.issues[0]?.path?.[0] }, { status: 400 });
    const { booking, token } = await createBooking(parsed.data);
    return NextResponse.json({ id: booking.id, token, status: booking.status });
  } catch (e) { return errorResponse(e); }
}
