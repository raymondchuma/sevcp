# SEVCP Office Hours

Branded booking page for SEVCP founders. Every booking is **one shared Google Calendar event** with the host,
all co-hosts and the founder, a Google Meet link, and invitations sent by Google.

- Public page: `/office-hours` · Founder links: `/office-hours/confirmed/:id`, `/office-hours/manage/:id` · Admin: `/office-hours/admin`
- Stack: Next.js 15 + TypeScript, Neon Postgres, Google Calendar API, Vercel

See **[docs/SETUP.md](docs/SETUP.md)** for architecture, Google Cloud/OAuth setup, calendar permissions, deployment and the real-calendar verification checklist.

```bash
npm install && npm run dev   # http://localhost:4620/office-hours (mock calendar, embedded DB)
npm test                     # acceptance tests A–I
```
