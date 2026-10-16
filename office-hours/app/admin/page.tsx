import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { calendarMode } from '@/lib/google';
import { getSettings } from '@/lib/settings';
import { formatSlot } from '@/lib/time';
import { manageUrl } from '@/lib/booking';
import ActionButton from '@/components/admin/ActionButton';
import { AdminReschedule, CalendarPicker, SettingsForm, TestAccess } from '@/components/admin/Forms';
import { adminCancel, disconnectGoogle, resolveEvent, retry, runRecovery } from '@/lib/admin-actions';
import { configuredAttendees, CALENDAR_NAME } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard · SEVCP Office Hours', robots: { index: false } };

type Row = { id: string; first_name: string; surname: string; email: string; startup_name: string; session_notes: string | null; start_at: Date; timezone: string; status: string; google_meet_url: string | null; created_at: Date; attendees: { name: string | null; email: string; role: string }[] | null };

const NOTICES: Record<string, string> = { connected: 'Google Calendar connected.', calendar_missing: `Connected, but no calendar named “${CALENDAR_NAME}” was found in that account. Create it in Google Calendar (or pick another below) — until then events go to the primary calendar.`, no_refresh_token: 'Google didn’t return a refresh token. Remove the app’s access at myaccount.google.com/permissions, then connect again.', scopes: 'Please grant both calendar permissions (events and free/busy) when connecting.', oauth: 'Connecting Google failed. Please try again.' };

export default async function Admin({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; connected?: string; error?: string; calendar?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const d = await db();
  const s = await getSettings(d);
  let mode: string; try { mode = calendarMode(); } catch (e) { mode = `misconfigured: ${(e as Error).message}`; }
  const [cred] = await d.query<{ account_email: string; connected_at: Date }>('SELECT account_email, connected_at FROM google_credentials WHERE id = 1');
  const issues = await d.query<{ id: string; kind: string; subject: string | null; message: string; created_at: Date }>(`SELECT id, kind, subject, message, created_at FROM integration_events WHERE NOT resolved ORDER BY created_at DESC LIMIT 20`);
  const failedOps = await d.query<{ booking_id: string; operation_type: string; error_message: string | null; attempt_count: number; updated_at: Date; startup_name: string; status: string; start_at: Date }>(
    `SELECT o.booking_id, o.operation_type, o.error_message, o.attempt_count, o.updated_at, b.startup_name, b.status, b.start_at FROM booking_operations o JOIN bookings b ON b.id = o.booking_id
     WHERE o.status = 'failed' AND o.updated_at > now() - interval '30 days' ORDER BY o.updated_at DESC LIMIT 20`);

  const q = (sp.q || '').trim();
  const show = sp.show === 'all' ? 'all' : 'upcoming';
  const params: unknown[] = [];
  let where = show === 'upcoming' ? `b.end_at > now() AND b.status IN ('confirmed','pending')` : 'true';
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where += ` AND (lower(b.startup_name) LIKE $1 OR lower(b.first_name || ' ' || b.surname) LIKE $1 OR lower(b.email) LIKE $1 OR to_char(b.start_at AT TIME ZONE b.timezone, 'YYYY-MM-DD') LIKE $1)`;
  }
  const rows = await d.query<Row>(`SELECT b.*, (SELECT json_agg(json_build_object('name', a.name, 'email', a.email, 'role', a.role) ORDER BY a.role) FROM booking_attendees a WHERE a.booking_id = b.id) AS attendees
    FROM bookings b WHERE ${where} ORDER BY b.start_at ${show === 'upcoming' ? 'ASC' : 'DESC'} LIMIT 200`, params);

  return (
    <main className="admin">
      <section className="hero" style={{ padding: '38px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><span className="eyebrow mono"><i />Admin</span><h1 className="big" style={{ margin: '14px 0 0' }}>Office Hours</h1></div>
          <div style={{ textAlign: 'right', fontSize: 14, color: '#5D5D52' }}>Signed in as {admin.email}
            <form action="/office-hours/api/auth/logout" method="post" style={{ marginTop: 8 }}><button className="btn ghost sm">Sign out</button></form></div>
        </div>
        {(sp.connected || sp.error) && <div className={`notice${sp.connected && !sp.calendar ? ' ok' : ''}`} style={{ marginTop: 18 }}>{NOTICES[sp.connected ? (sp.calendar === 'missing' ? 'calendar_missing' : 'connected') : sp.error!] || 'Something went wrong.'}</div>}
      </section>

      <div className="adgrid">
        <section className="card">
          <h2>Calendar connection</h2>
          <p className="sub">Mode: <b>{mode}</b>{mode === 'mock' && ' — simulated calendar for local testing; no real invitations are sent.'}</p>
          {mode === 'live' && (cred
            ? <><p>Connected as <b>{cred.account_email}</b> since {new Date(cred.connected_at).toLocaleDateString('en-GB')}.</p>
                <p>Events are created on {s.calendar_id === 'primary' ? <b>the primary calendar</b> : <><b>{CALENDAR_NAME}</b> <code className="wrapcode">{s.calendar_id}</code></>}.</p>
                <CalendarPicker current={s.calendar_id} /></>
            : <div className="notice">Not connected — booking is paused. Connect the Google account that owns the office-hours calendar.</div>)}
          <div className="btns">
            {mode === 'live' && <a className="btn" href="/office-hours/api/auth/google/start?purpose=calendar">{cred ? 'Reconnect Google' : 'Connect Google Calendar'}</a>}
            {mode === 'live' && cred && <ActionButton action={disconnectGoogle} label="Disconnect" confirm="Disconnect Google Calendar? Booking pauses until reconnected." />}
          </div>
          <div style={{ marginTop: 18 }}><TestAccess /></div>
        </section>

        <section className="card">
          <h2>Needs attention {issues.length + failedOps.length > 0 && <span className="badge">{issues.length + failedOps.length}</span>}</h2>
          <p className="sub">Calendar access problems and failed calendar operations.</p>
          {!issues.length && !failedOps.length && <div className="empty">All clear.</div>}
          {issues.map((i) => (
            <div key={i.id} className="issue"><div><b className="mono">{i.kind.replace('_', ' ')}</b> <small>{new Date(i.created_at).toLocaleString('en-GB', { timeZone: s.timezone })}</small><p>{i.message}</p></div><ActionButton action={resolveEvent.bind(null, i.id)} label="Resolve" /></div>
          ))}
          {failedOps.map((o, n) => (
            <div key={n} className="issue"><div><b className="mono">{o.operation_type.replace('_', ' ')} · {o.startup_name}</b> <small>{formatSlot(new Date(o.start_at), s.timezone).short} · {o.attempt_count} attempt(s) · booking {o.status}</small><p>{o.error_message}</p></div>
              {o.status === 'failed' && new Date(o.start_at) > new Date() && <ActionButton action={retry.bind(null, o.booking_id)} label="Retry booking" className="btn sm" />}</div>
          ))}
          <div className="btns"><ActionButton action={runRecovery} label="Run recovery now" /></div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <div><h2>Bookings</h2><p className="sub" style={{ margin: 0 }}>{show === 'upcoming' ? 'Upcoming confirmed sessions' : 'All bookings, newest first'} · {rows.length}</p></div>
          <form className="search" method="get">
            <input name="q" defaultValue={q} placeholder="Search startup, founder, email or YYYY-MM-DD" aria-label="Search bookings" />
            <select name="show" defaultValue={show} aria-label="Show"><option value="upcoming">Upcoming</option><option value="all">All</option></select>
            <button className="btn sm">Search</button>
          </form>
        </div>
        <div className="tablewrap">
          {rows.length === 0 ? <div className="empty" style={{ marginTop: 16 }}>No bookings{q ? ' match that search' : ' yet'}.</div> : rows.map((b) => {
            const w = formatSlot(new Date(b.start_at), b.timezone);
            return (
              <details key={b.id} className="booking">
                <summary>
                  <span className="when"><b>{w.date.replace(/ \d{4}$/, '')}</b><small>{w.time} WAT</small></span>
                  <span className="who"><b>{b.startup_name}</b><small>{b.first_name} {b.surname} · {b.email}</small></span>
                  <span className={`pill ${b.status}`}>{b.status}</span>
                </summary>
                <div className="detail">
                  {b.session_notes && <p><b>Notes:</b> {b.session_notes}</p>}
                  <p><b>Invited:</b> {(b.attendees || []).map((a) => `${a.name || a.email} (${a.role})`).join(', ')}</p>
                  {b.google_meet_url && <p><b>Meet:</b> <a href={b.google_meet_url} target="_blank" rel="noopener">{b.google_meet_url}</a></p>}
                  <p><b>Founder’s manage link:</b> <code className="wrapcode">{manageUrl(b.id)}</code></p>
                  <p style={{ color: '#77776B', fontSize: 13 }}>Booked {new Date(b.created_at).toLocaleString('en-GB', { timeZone: s.timezone })}</p>
                  {b.status === 'confirmed' && new Date(b.start_at) > new Date() && <div className="btns">
                    <AdminReschedule id={b.id} />
                    <ActionButton action={adminCancel.bind(null, b.id)} label="Cancel booking" className="btn danger sm" confirm={`Cancel ${b.startup_name}'s session? All attendees will be notified.`} />
                  </div>}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <div className="adgrid" style={{ marginBottom: 80 }}>
        <section className="card">
          <h2>Invited to every session</h2>
          <p className="sub">Set by the <code>OFFICE_HOURS_ATTENDEES</code> environment variable in Vercel — hosts and guests never need to sign in. Required people must be free for a slot to be offered; optional guests are invited but never block.</p>
          <div className="people">
            {!configuredAttendees().length && <div className="notice">OFFICE_HOURS_ATTENDEES isn’t set — booking is paused until a host is configured.</div>}
            {configuredAttendees().map((p) => (
              <div key={p.email} className="person">
                <div><b>{p.name}</b> <span className={`pill ${p.role}`}>{p.role === 'host' ? 'Host' : 'Guest'}</span><span className={`pill ${p.optional ? '' : 'confirmed'}`}>{p.optional ? 'Optional' : 'Required'}</span><small>{p.email}</small></div>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Scheduling rules</h2>
          <p className="sub">Changes apply to new bookings immediately.</p>
          <SettingsForm s={s as never} />
        </section>
      </div>
    </main>
  );
}
