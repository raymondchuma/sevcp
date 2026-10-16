import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Constant-time compare of a presented token against a stored sha256 hash. */
export function tokenMatches(token: string | null | undefined, hash: string): boolean {
  if (!token) return false;
  const a = Buffer.from(sha256(token), 'hex'), b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function secret(name: 'ENCRYPTION_KEY' | 'SESSION_SECRET'): Buffer {
  const v = process.env[name];
  if (v) return createHash('sha256').update(v).digest();
  if (process.env.VERCEL) throw new Error(`${name} must be set in production`);
  return createHash('sha256').update(`sevcp-office-hours-dev-${name}`).digest(); // local dev only
}

/** AES-256-GCM. Output: iv.tag.ciphertext (base64url). Used for the Google refresh token. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', secret('ENCRYPTION_KEY'), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}
export function decrypt(blob: string): string {
  const [iv, tag, ct] = blob.split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', secret('ENCRYPTION_KEY'), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

/** Signed, expiring value for cookies: base64url(payload).hmac */
export function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', secret('SESSION_SECRET')).update(body).digest('base64url')}`;
}
export function verify<T extends { exp: number }>(value: string | undefined): T | null {
  if (!value) return null;
  const [body, mac] = value.split('.');
  if (!body || !mac) return null;
  const want = createHmac('sha256', secret('SESSION_SECRET')).update(body).digest();
  const got = Buffer.from(mac, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as T;
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

/** Google event IDs must be base32hex (a–v, 0–9), 5–1024 chars. Deterministic per booking so retries can't duplicate. */
export const eventIdFor = (bookingId: string) => 'sevcpoh' + bookingId.replace(/-/g, '').toLowerCase();
