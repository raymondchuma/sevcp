import { notFound } from 'next/navigation';
import Link from 'next/link';
import { founderView } from '@/lib/view';
import ManageActions from '@/components/ManageActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Manage booking · SEVCP Office Hours', robots: { index: false } };

export default async function Manage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params; const { t } = await searchParams;
  const v = await founderView(id, t);
  if (!v) notFound();
  const { b, when, token } = v;
  const upcoming = new Date(b.start_at) > new Date();
  const canChange = b.status === 'confirmed' && upcoming;
  return (
    <main>
      <section className="hero rise">
        <span className="eyebrow mono"><i style={{ background: b.status === 'confirmed' ? '#237922' : '#E86642' }} />Manage booking</span>
        <h1 className="big">{b.startup_name}</h1>
        <p>{when.date} · {when.time} West Africa Time ({when.tz})</p>
      </section>
      <div className="grid">
        <section className="card">
          <h2>{b.status === 'cancelled' ? 'This booking is cancelled' : b.status === 'confirmed' ? (upcoming ? 'Your session' : 'This session has passed') : b.status === 'pending' ? 'Still confirming…' : 'This booking was not confirmed'}</h2>
          <p className="sub">{b.first_name} {b.surname} · {b.email}</p>
          {b.google_meet_url && b.status === 'confirmed' && <p><a className="meet" href={b.google_meet_url} target="_blank" rel="noopener">Join Google Meet ↗</a></p>}
          <ManageActions id={b.id} token={token} canChange={canChange} />
          {(b.status === 'cancelled' || b.status === 'failed') && <div className="btns"><Link className="btn" href="/">Book a new session</Link></div>}
        </section>
        <aside className="aside">
          <h3>Good to know</h3>
          <ul>
            <li><b>01</b>Rescheduling keeps the same invitation and Meet link.</li>
            <li><b>02</b>Cancelling notifies the host, co-hosts and you.</li>
          </ul>
          <div className="meta">Need help? <a href="mailto:sevcp@sedc.gov.ng">sevcp@sedc.gov.ng</a></div>
        </aside>
      </div>
    </main>
  );
}
