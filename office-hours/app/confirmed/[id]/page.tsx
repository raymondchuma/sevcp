import { notFound } from 'next/navigation';
import Link from 'next/link';
import { founderView } from '@/lib/view';
import StatusPoller from '@/components/StatusPoller';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Booking confirmed · SEVCP Office Hours', robots: { index: false } };

export default async function Confirmed({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params; const { t } = await searchParams;
  const v = await founderView(id, t);
  if (!v) notFound();
  const { b, people, when, token } = v;
  const team = people.filter((p) => p.role !== 'founder');
  const manage = `/manage/${b.id}?t=${encodeURIComponent(token)}`;
  const status = {
    confirmed: { label: 'Booking confirmed', eyebrow: 'Confirmed', line: `A Google Calendar invitation is on its way to ${b.email} and the SEVCP team.` },
    pending: { label: 'Finalising your booking…', eyebrow: 'Confirming', line: 'We’re confirming your session with Google Calendar. This page updates automatically.' },
    cancelled: { label: 'Booking cancelled', eyebrow: 'Cancelled', line: 'This session was cancelled and everyone was notified.' },
    failed: { label: 'We couldn’t confirm this booking', eyebrow: 'Not booked', line: 'Nothing was booked. Please choose a time and try again.' },
  }[b.status];

  return (
    <main>
      {b.status === 'pending' && <StatusPoller id={b.id} token={token} />}
      <section className="hero rise">
        <span className="eyebrow mono"><i style={{ background: b.status === 'confirmed' ? '#237922' : b.status === 'pending' ? '#F3BC45' : '#E86642' }} />{status.eyebrow}</span>
        <h1 className="big">{status.label}</h1>
        <p>{status.line}</p>
        {b.status === 'confirmed' && b.google_meet_url && <div className="btns"><a className="meet" href={b.google_meet_url} target="_blank" rel="noopener">Join Google Meet ↗</a></div>}
      </section>
      <div className="grid">
        <section className="card">
          <h2>{b.startup_name}</h2>
          <p className="sub">SEVCP Office Hours</p>
          <div className="review">
            <div className="row"><span className="mono">Date</span><div>{when.date}</div></div>
            <div className="row"><span className="mono">Time</span><div>{when.time}</div></div>
            <div className="row"><span className="mono">Duration</span><div>30 minutes</div></div>
            <div className="row"><span className="mono">Time zone</span><div>West Africa Time ({when.tz})</div></div>
            {b.google_meet_url && <div className="row"><span className="mono">Meet link</span><div><a href={b.google_meet_url} target="_blank" rel="noopener">{b.google_meet_url.replace('https://', '')}</a></div></div>}
            <div className="row"><span className="mono">With</span><div>{team.map((p) => <div key={p.email}>{p.name || p.email}<span style={{ color: '#77776B' }}> · {p.role === 'host' ? 'Host' : p.is_optional ? 'Guest (optional)' : 'Guest'}</span></div>)}</div></div>
          </div>
          {(b.status === 'confirmed' || b.status === 'pending') && <div className="btns">
            <Link className="btn ghost" href={manage}>Reschedule</Link>
            <Link className="btn danger" href={manage}>Cancel booking</Link>
          </div>}
          {b.status === 'failed' && <div className="btns"><Link className="btn" href="/">Pick another time</Link></div>}
        </section>
        <aside className="aside">
          <h3>Keep this link</h3>
          <ul><li><b>→</b>Bookmark this page, or use the link in your calendar invitation, to cancel or reschedule later.</li></ul>
          <div className="meta">Didn’t get the invitation within a few minutes? Check spam, then email <a href="mailto:sevcp@sedc.gov.ng">sevcp@sedc.gov.ng</a>.</div>
        </aside>
      </div>
    </main>
  );
}
