# SEVCP Office Hours — architecture & setup

Founders book a 30-minute session at **sevcp.sedc.gov.ng/office-hours**. Each booking creates **one** Google
Calendar event on the host calendar with the host, every active co-host and the founder as attendees, a Google
Meet link, and `sendUpdates=all` so Google itself sends every invitation (no separate email service).

## Architecture

| Piece | Where |
|---|---|
| Next.js 15 app (App Router, TypeScript), `basePath: /office-hours` | `office-hours/` in the `sevcp` repo, deployed as its own Vercel project (`sevcp-office-hours`, Root Directory `office-hours`) |
| Public URL | the main static site (same repo) rewrites `/office-hours/*` to that project. Don't add a root `.vercelignore` for this folder — Vercel applies it to both projects and the app build loses its source |
| Database | Neon Postgres (`DATABASE_URL`); embedded PGlite locally when unset |
| Calendar | Google Calendar REST API via the admin-connected account (`lib/google/live.ts`); in-memory mock for dev/tests (`lib/google/mock.ts`) |
| Admin auth | Google sign-in, restricted to `ADMIN_EMAILS` |

Services (`lib/`): `availability.ts` (rules + free/busy for host and all co-hosts, fail-closed), `booking.ts`
(reserve → create event → verify → confirm; cancel; reschedule; retry; reconcile), `time.ts` (time-zone-safe
slot generation), `schema.ts` (idempotent schema, applied on cold start).

### Guarantees and how they're enforced
- **One event per booking, never duplicated** — the Google event ID is derived from the booking ID before the API call, so any retry gets `409` and reads the existing event instead of creating another.
- **No double booking** — slot holds live in `reservations` with a Postgres `EXCLUDE USING gist (slot WITH &&)` constraint, taken inside a transaction under a per-day advisory lock (which also enforces the daily cap).
- **Never a false confirmation** — a booking becomes `confirmed` only after Google returns the event containing every snapshot attendee and a Meet link.
- **Fail closed** — if any required calendar's free/busy can't be read, no slots are offered and an actionable error appears on the dashboard.
- **Recovery** — failures release the slot and queue a cleanup that deletes any event Google created anyway; pending bookings are finished by `reconcile()` (daily cron, the dashboard button, and an automatic check on public traffic).
- **Times** — stored as UTC `timestamptz`; the booking's zone (Africa/Lagos) is stored alongside and sent to Google.

Defaults (editable in the dashboard): Mon–Fri 11:00–15:00 WAT, 30-minute slots, max 2 per day, 4 h minimum notice, 60-day window, 0 min buffer.

## 1. Google Cloud (one-time, ~10 minutes)
1. console.cloud.google.com → create a project (e.g. "SEVCP Office Hours").
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **OAuth consent screen** → User type: *External* (or *Internal* if the calendar account is in a Google Workspace org) → app name "SEVCP Office Hours", support email, authorised domain `sedc.gov.ng` → scopes: `openid`, `email`, `profile`, `.../auth/calendar.events`, `.../auth/calendar.freebusy`, `.../auth/calendar.calendarlist.readonly`. While in *Testing*, add the calendar owner and every admin as test users (or publish the app).
4. **Credentials → Create credentials → OAuth client ID → Web application**. Authorised redirect URIs:
   - `https://sevcp.sedc.gov.ng/office-hours/api/auth/google/callback`
   - `http://localhost:4620/office-hours/api/auth/google/callback` (local testing)
5. Copy the client ID and secret into the Vercel env vars below.

## 2. Who is invited, and calendar permissions
Invitees are fixed configuration in the **`OFFICE_HOURS_ATTENDEES`** Vercel environment variable (kept out of this public repo; no one but admins ever signs in). Current setup: the SEDC Google account as **host** (required, owns the calendar), one **required** guest, and one **optional** guest (invited as optional; never blocks a slot). Format is documented in `lib/config.ts`.

- **Connect Google as the SEDC host account.** Events are created on its **“SEVCP Office Hours”** calendar — found automatically by name on connect (or pick it on the dashboard). Anything placed directly on that calendar also blocks slots.
- **Every required guest must share free/busy with the SEDC account**: Google Calendar → Settings → *Settings for my calendars* → their calendar → *Share with specific people* → add the SEDC address with **“See only free/busy (hide details)”**. Until then the app fails closed and booking stays paused (the dashboard shows exactly this).
- Optional guests don't need to share anything — they aren't checked.
- After any change, click **Test calendar access** on the dashboard — every required row must show ✓.

## 3. Deploy
1. Create a Neon database (or add Neon from the Vercel Marketplace) → `DATABASE_URL`.
2. Vercel project `sevcp-office-hours` → Git: `raymondchuma/sevcp`, **Root Directory `office-hours`**, framework Next.js → set the env vars from `.env.example` (`GOOGLE_*`, `PUBLIC_BASE_URL=https://sevcp.sedc.gov.ng`, `ADMIN_EMAILS`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `CRON_SECRET`, `DATABASE_URL`).
3. The main site's `build-previews.mjs` adds the rewrite `/office-hours/:path*` → `https://<this-project>.vercel.app/office-hours/:path*` ahead of the SPA catch-all. Push to deploy.
4. Visit `/office-hours/admin` → sign in → **Connect Google Calendar** as the SEDC host account → confirm it shows “SEVCP Office Hours” → **Test calendar access** → adjust rules if needed.

## 4. Verify against a real calendar before launch (PRD §14.10)
Use a test calendar and test founder address:
1. Book a slot → all attendees (host, each co-host, founder) receive **one** invitation with the same Meet link.
2. Put a busy event on a co-host's calendar → that slot disappears (and is rejected if already open in another tab).
3. Cancel from the founder link → everyone receives the cancellation; slot reappears.
4. Reschedule → everyone receives the update; same event, same Meet link.
5. Remove the connected account's access to one co-host's calendar → dashboard shows the error; booking pauses.

## Local development
```bash
npm install
npm run dev          # http://localhost:4620/office-hours — mock calendar + embedded DB; "Local dev sign-in" on /admin/login
npm test             # acceptance tests A–I (mock Google, in-memory Postgres)
```
Data lives in `.data/pglite` (delete it to reset).
