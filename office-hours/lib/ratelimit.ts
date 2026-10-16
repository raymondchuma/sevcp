import 'server-only';
import { db } from './db';
import { sha256 } from './crypto';

/** Fixed-window limiter backed by Postgres (works across serverless instances). */
export async function rateLimit(ip: string, route: string, limit: number, windowSec: number): Promise<boolean> {
  const d = await db();
  const win = new Date(Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000);
  const [row] = await d.query<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1 RETURNING count`,
    [`${route}:${sha256(ip).slice(0, 24)}`, win]);
  if (Math.random() < 0.02) await d.query(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
  return row.count <= limit;
}
export const clientIp = (h: Headers) => (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'local';
