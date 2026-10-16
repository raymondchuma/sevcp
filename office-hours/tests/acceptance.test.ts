import { describe, it, expect, beforeEach } from 'vitest';
import { freshEnv, slotAt, founder, HOST, CO1, CO2, TZ, OFFICE_CAL } from './helpers';
import { mockState } from '@/lib/google/mock';
import { availability } from '@/lib/availability';
import { createBooking, cancelBooking, rescheduleBooking, retryBooking, reconcile, manageToken, BookingError, getBooking } from '@/lib/booking';
import type { Q } from '@/lib/db';

let d: Q;
beforeEach(async () => { d = await freshEnv(); });

const offered = async (day: string, start: Date) => {
  const av = await availability(d, day, day);
  return av.ok && av.slots.some((s) => s.start.getTime() === start.getTime());
};
const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return (e as BookingError).code; } };

describe('A: successful booking', () => {
  it('creates exactly one event with host, every co-host and the founder, one Meet link, invitations to all', async () => {
    const s = slotAt('11:00');
    expect(await offered(s.day, s.start)).toBe(true);
    const { booking } = await createBooking(founder(1, s.iso));
    expect(booking.status).toBe('confirmed');
    const events = [...mockState().events.values()];
    expect(events).toHaveLength(1);
    expect(events[0].attendees.sort()).toEqual([HOST, CO1, CO2, 'founder1@startup.test'].sort());
    expect(events[0].summary).toBe('SEVCP Office Hours | Startup 1');
    expect(booking.google_meet_url).toBe(events[0].meetUrl);
    const invites = mockState().notifications.filter((n) => n.type === 'invite');
    expect(invites).toHaveLength(1);
    expect(invites[0].to.sort()).toEqual([HOST, CO1, CO2, 'founder1@startup.test'].sort());
    // Booked slot is no longer offered.
    expect(await offered(s.day, s.start)).toBe(false);
  });
});

describe('B: co-host unavailable', () => {
  it('does not offer the slot when the required guest is busy', async () => {
    const s = slotAt('11:00');
    mockState().busy.set(CO1, [{ start: s.start, end: s.end }]);
    expect(await offered(s.day, s.start)).toBe(false);
    expect(await code(createBooking(founder(1, s.iso)))).toBe('slot_unavailable');
    expect(mockState().events.size).toBe(0);
  });
  it('rejects at final validation if the co-host becomes busy after the slot was shown', async () => {
    const s = slotAt('11:30');
    expect(await offered(s.day, s.start)).toBe(true);
    mockState().busy.set(CO1, [{ start: new Date(s.start.getTime() + 10 * 60000), end: new Date(s.start.getTime() + 20 * 60000) }]);
    expect(await code(createBooking(founder(1, s.iso)))).toBe('slot_unavailable');
    const [{ n }] = await d.query<{ n: number }>(`SELECT count(*)::int n FROM bookings WHERE status = 'confirmed'`);
    expect(n).toBe(0);
  });
});

describe('Optional guest', () => {
  it('is invited as optional and never blocks availability (even if busy or unreadable)', async () => {
    const s = slotAt('12:00');
    mockState().busy.set(CO2, [{ start: s.start, end: s.end }]);
    mockState().inaccessible.add(CO2);
    expect(await offered(s.day, s.start)).toBe(true);
    const { booking } = await createBooking(founder(1, s.iso));
    expect(booking.status).toBe('confirmed');
    const ev = [...mockState().events.values()][0];
    expect(ev.attendees).toContain(CO2);
    expect(ev.optional).toEqual([CO2]);
  });
});

describe('Booking calendar', () => {
  it('creates events on the SEVCP Office Hours calendar and treats its existing events as busy', async () => {
    const a = slotAt('11:00'), b = slotAt('13:00');
    const { booking } = await createBooking(founder(1, a.iso));
    expect([...mockState().events.values()][0].calendarId).toBe(OFFICE_CAL);
    expect(booking.status).toBe('confirmed');
    // A manual block placed directly on the office-hours calendar hides that slot.
    mockState().busy.set(OFFICE_CAL.toLowerCase(), [{ start: b.start, end: b.end }]);
    expect(await offered(b.day, b.start)).toBe(false);
  });
});

describe('C: host unavailable', () => {
  it('makes the slot unbookable', async () => {
    const s = slotAt('12:00');
    mockState().busy.set(HOST, [{ start: s.start, end: s.end }]);
    expect(await offered(s.day, s.start)).toBe(false);
    expect(await code(createBooking(founder(1, s.iso)))).toBe('slot_unavailable');
  });
});

describe('D: concurrent bookings', () => {
  it('confirms at most one booking and creates one event', async () => {
    const s = slotAt('13:00');
    const results = await Promise.allSettled([createBooking(founder(1, s.iso)), createBooking(founder(2, s.iso)), createBooking(founder(3, s.iso))]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results) if (r.status === 'rejected') expect((r.reason as BookingError).code).toBe('slot_unavailable');
    expect(mockState().events.size).toBe(1);
    const [{ n }] = await d.query<{ n: number }>(`SELECT count(*)::int n FROM bookings WHERE status = 'confirmed'`);
    expect(n).toBe(1);
  });
  it('enforces the daily cap (2) and is idempotent on resubmit', async () => {
    const a = slotAt('11:00'), b = slotAt('11:30'), c = slotAt('14:00');
    const first = await createBooking({ ...founder(1, a.iso), idempotencyKey: 'k1' });
    const again = await createBooking({ ...founder(1, a.iso), idempotencyKey: 'k1' });
    expect(again.booking.id).toBe(first.booking.id);
    await createBooking(founder(2, b.iso));
    expect(await offered(c.day, c.start)).toBe(false);
    expect(await code(createBooking(founder(3, c.iso)))).toBe('slot_unavailable');
    expect(mockState().events.size).toBe(2);
  });
});

describe('E: calendar API failure', () => {
  it('never shows a false confirmation, logs the failure, releases the slot, and can be retried safely', async () => {
    const s = slotAt('14:00');
    mockState().failNext.insert = 403;
    expect(await code(createBooking(founder(1, s.iso)))).toBe('calendar_failed');
    const [b] = await d.query<{ id: string; status: string }>(`SELECT id, status FROM bookings`);
    expect(b.status).toBe('failed');
    const [opr] = await d.query<{ status: string; error_message: string }>(`SELECT status, error_message FROM booking_operations WHERE operation_type = 'create_event'`);
    expect(opr.status).toBe('failed');
    expect(opr.error_message).toMatch(/403/);
    expect(await offered(s.day, s.start)).toBe(true);
    const retried = await retryBooking(b.id);
    expect(retried.status).toBe('confirmed');
    expect(mockState().events.size).toBe(1);
  });
  it('recovers from a timeout after Google created the event without duplicating it', async () => {
    const s = slotAt('14:30');
    mockState().insertSucceedsThenErrors = true;
    const { booking } = await createBooking(founder(1, s.iso));
    expect(booking.status).toBe('confirmed');
    expect(mockState().events.size).toBe(1);
    expect(mockState().notifications.filter((n) => n.type === 'invite')).toHaveLength(1);
  });
  it('reconciliation removes an event that exists for a booking reported as failed', async () => {
    const s = slotAt('13:30');
    mockState().insertSucceedsThenErrors = true;
    mockState().failNext.insert = 500;       // 1st insert: 500 (nothing created)
    // 2nd insert creates then times out; 3rd gets 409 → read ok. Force failure instead by making reads fail:
    const prevGet = (await import('@/lib/google/mock')).mockProvider.getEvent;
    const mp = (await import('@/lib/google/mock')).mockProvider as any;
    mp.getEvent = async () => { throw Object.assign(new Error('read failed'), { status: 503, retryable: true }); };
    expect(await code(createBooking(founder(1, s.iso)))).toBe('calendar_failed');
    mp.getEvent = prevGet;
    const ev = [...mockState().events.values()][0];
    expect(ev.status).toBe('confirmed');      // orphan event exists in Google
    const r = await reconcile();
    expect(r.cleaned).toBe(1);
    expect(ev.status).toBe('cancelled');
    expect(await offered(s.day, s.start)).toBe(true);
  });
});

describe('F: cancellation', () => {
  it('cancels the event, notifies attendees, and frees the slot', async () => {
    const s = slotAt('12:30');
    const { booking, token } = await createBooking(founder(1, s.iso));
    expect(await code(cancelBooking(booking.id, { token: 'wrong' }))).toBe('forbidden');
    const c = await cancelBooking(booking.id, { token });
    expect(c.status).toBe('cancelled');
    expect([...mockState().events.values()][0].status).toBe('cancelled');
    const cancel = mockState().notifications.find((n) => n.type === 'cancel')!;
    expect(cancel.to.sort()).toEqual([HOST, CO1, CO2, 'founder1@startup.test'].sort());
    expect(await offered(s.day, s.start)).toBe(true);
  });
  it('keeps the booking if Google cancellation fails', async () => {
    const s = slotAt('12:30');
    const { booking, token } = await createBooking(founder(1, s.iso));
    mockState().failNext.delete = 500;
    expect(await code(cancelBooking(booking.id, { token }))).toBe('calendar_failed');
    expect((await getBooking(d, booking.id))!.status).toBe('confirmed');
    expect(await offered(s.day, s.start)).toBe(false);
  });
});

describe('G: rescheduling', () => {
  it('moves the same event, keeps attendees and Meet link, notifies everyone, releases the old slot', async () => {
    const a = slotAt('11:00'), b = slotAt('14:30');
    const { booking, token } = await createBooking(founder(1, a.iso));
    const r = await rescheduleBooking(booking.id, { token }, b.iso);
    expect(new Date(r.start_at).getTime()).toBe(b.start.getTime());
    const events = [...mockState().events.values()];
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(booking.google_event_id);
    expect(events[0].start.getTime()).toBe(b.start.getTime());
    expect(events[0].attendees).toHaveLength(4);
    expect(r.google_meet_url).toBe(booking.google_meet_url);
    expect(mockState().notifications.some((n) => n.type === 'update' && n.to.length === 4)).toBe(true);
    expect(await offered(a.day, a.start)).toBe(true);
    expect(await offered(b.day, b.start)).toBe(false);
  });
  it('keeps the original appointment if the update fails', async () => {
    const a = slotAt('11:00'), b = slotAt('14:30');
    const { booking, token } = await createBooking(founder(1, a.iso));
    mockState().failNext.patch = 500;
    expect(await code(rescheduleBooking(booking.id, { token }, b.iso))).toBe('calendar_failed');
    const now = (await getBooking(d, booking.id))!;
    expect(new Date(now.start_at).getTime()).toBe(a.start.getTime());
    expect(await offered(b.day, b.start)).toBe(true);
  });
});

describe('H: permission failure', () => {
  it('fails closed and gives the admin an actionable error naming the co-host', async () => {
    const s = slotAt('11:00');
    mockState().inaccessible.add(CO1);
    const av = await availability(d, s.day, s.day);
    expect(av.ok).toBe(false);
    expect(await code(createBooking(founder(1, s.iso)))).toBe('unverified');
    const ev = await d.query<{ subject: string; message: string }>(`SELECT subject, message FROM integration_events WHERE NOT resolved`);
    expect(ev.some((e) => e.subject === CO1 && /free\/busy/.test(e.message))).toBe(true);
    expect(mockState().events.size).toBe(0);
  });
  it('also fails closed when the booking calendar itself can’t be read', async () => {
    const s = slotAt('11:00');
    mockState().inaccessible.add(OFFICE_CAL.toLowerCase());
    expect((await availability(d, s.day, s.day)).ok).toBe(false);
    expect(mockState().events.size).toBe(0);
  });
});

describe('I: time zones', () => {
  it('stores UTC, keeps Africa/Lagos for display, and creates the event at the same instant', async () => {
    const s = slotAt('11:00');
    const { booking } = await createBooking(founder(1, s.iso));
    expect(new Date(booking.start_at).toISOString()).toBe(new Date(s.iso).toISOString());
    expect(new Date(booking.start_at).getUTCHours()).toBe(10);   // 11:00 WAT = 10:00 UTC
    expect(booking.timezone).toBe(TZ);
    const ev = [...mockState().events.values()][0];
    expect(ev.timeZone).toBe(TZ);
    expect(ev.start.getTime()).toBe(new Date(booking.start_at).getTime());
  });
  it('rejects times outside office hours or misaligned', async () => {
    expect(await code(createBooking(founder(1, slotAt('10:00').iso)))).toBe('slot_unavailable'); // before 11:00
    expect(await code(createBooking(founder(1, slotAt('15:00').iso)))).toBe('slot_unavailable'); // 15:00 start would end after 3pm
    expect(await code(createBooking(founder(1, slotAt('11:10').iso)))).toBe('slot_unavailable');
    expect(await code(createBooking(founder(1, slotAt('11:00', 120).iso)))).toBe('slot_unavailable'); // beyond 60-day window
  });
  it('manage tokens are per booking', () => { expect(manageToken('a')).not.toBe(manageToken('b')); });
});
