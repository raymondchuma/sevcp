import { describe, it, expect, beforeAll } from 'vitest';
process.env.PGLITE_DIR = 'memory';
import { db } from '@/lib/db';

describe('db', () => {
  beforeAll(async () => { await db(); });
  it('applies schema and enforces the no-overlap exclusion constraint', async () => {
    const d = await db();
    const [b] = await d.query<{ id: string }>(`INSERT INTO bookings (first_name,surname,email,startup_name,start_at,end_at,timezone,status,google_event_id,cancellation_token_hash)
      VALUES ('a','b','a@x.com','s','2030-01-01T09:00Z','2030-01-01T09:30Z','Africa/Lagos','pending','e1','h') RETURNING id`);
    await d.query(`INSERT INTO reservations (booking_id,slot,local_day,kind) VALUES ($1, tstzrange('2030-01-01T09:00Z','2030-01-01T09:30Z'), '2030-01-01','booking')`, [b.id]);
    await expect(d.query(`INSERT INTO reservations (booking_id,slot,local_day,kind) VALUES ($1, tstzrange('2030-01-01T09:15Z','2030-01-01T09:45Z'), '2030-01-01','booking')`, [b.id])).rejects.toThrow();
    // Adjacent (half-open ranges) is fine.
    await d.query(`INSERT INTO reservations (booking_id,slot,local_day,kind) VALUES ($1, tstzrange('2030-01-01T09:30Z','2030-01-01T10:00Z'), '2030-01-01','booking')`, [b.id]);
  });
});
