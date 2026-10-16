import 'server-only';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { SCHEMA_SQL } from './schema';
import { configuredAttendees } from './config';

/** Minimal query surface shared by Neon (production) and PGlite (local dev + tests). */
export interface Q {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}
interface Driver extends Q {
  tx<T>(fn: (q: Q) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
}

/** Neon's Vercel integration may expose the URL under any of these names. */
const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || '';

async function neonDriver(url: string): Promise<Driver> {
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  if (typeof WebSocket === 'undefined') neonConfig.webSocketConstructor = (await import('ws')).default;
  const pool = new Pool({ connectionString: url });
  return {
    async query(text, params) { return (await pool.query(text, params as unknown[])).rows; },
    async exec(sql) { await pool.query(sql); },
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const out = await fn({ query: async (t, p) => (await c.query(t, p as unknown[])).rows });
        await c.query('COMMIT');
        return out;
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
      finally { c.release(); }
    },
  };
}

async function pgliteDriver(): Promise<Driver> {
  if (process.env.VERCEL) throw new Error('No database configured: set DATABASE_URL (Neon) in the Vercel project. The embedded PGlite fallback is local-only.');
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR;
  let client;
  if (dir === 'memory') client = await PGlite.create();
  else {
    const d = dir || path.join(process.cwd(), '.data', 'pglite');
    mkdirSync(d, { recursive: true });
    client = await PGlite.create(d);
  }
  // PGlite is single-connection: serialize transactions so they can't interleave.
  let chain: Promise<unknown> = Promise.resolve();
  return {
    async query(text, params) { return (await client.query(text, params as unknown[])).rows as never; },
    async exec(sql) { await client.exec(sql); },
    tx(fn) {
      const run = chain.then(() => client.transaction((t) => fn({ query: async (q, p) => (await t.query(q, p as unknown[])).rows as never })));
      chain = run.catch(() => {});
      return run;
    },
  };
}

type G = { __ohDb?: Promise<Driver> };
const g = globalThis as unknown as G;

export function db(): Promise<Driver> {
  if (!g.__ohDb) {
    g.__ohDb = (async () => {
      const url = databaseUrl();
      const d = url ? await neonDriver(url) : await pgliteDriver();
      await d.exec(SCHEMA_SQL);
      await syncAttendees(d);
      return d;
    })().catch((e) => { g.__ohDb = undefined; throw e; });
  }
  return g.__ohDb;
}

/** Makes the attendees table match OFFICE_HOURS_ATTENDEES (fixed host + guests). No-op when unset. */
async function syncAttendees(d: Driver) {
  const ATTENDEES = configuredAttendees();
  if (!ATTENDEES.length) return;
  await d.tx(async (q) => {
    const emails = ATTENDEES.map((a) => a.email.toLowerCase());
    await q.query(`UPDATE attendees SET is_active = false WHERE NOT (lower(email) = ANY($1::text[]))`, [emails]);
    await q.query(`UPDATE attendees SET role = 'cohost' WHERE role = 'host' AND lower(email) <> $1`, [ATTENDEES.find((a) => a.role === 'host')!.email.toLowerCase()]);
    for (const a of ATTENDEES)
      await q.query(`INSERT INTO attendees (name, email, role, is_optional, is_active) VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (lower(email)) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_optional = EXCLUDED.is_optional, is_active = true`, [a.name, a.email.toLowerCase(), a.role, a.optional]);
    await q.query(`UPDATE settings SET host_email = $1 WHERE id = 1`, [ATTENDEES.find((a) => a.role === 'host')!.email.toLowerCase()]);
  });
}

/** Test helper: drop the cached connection (fresh in-memory DB per test file). */
export function resetDbForTests() { g.__ohDb = undefined; }
