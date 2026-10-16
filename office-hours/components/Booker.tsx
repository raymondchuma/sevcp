'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SlotPicker, { PickedSlot } from './SlotPicker';

type Fields = { firstName: string; surname: string; email: string; startupName: string; notes: string };
const EMPTY: Fields = { firstName: '', surname: '', email: '', startupName: '', notes: '' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const longDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });

export default function Booker() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [f, setF] = useState<Fields>(EMPTY);
  const [errs, setErrs] = useState<Partial<Record<keyof Fields, string>>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const idem = useMemo(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)), [slot?.start]);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setErrs({ ...errs, [k]: undefined }); };
  const validate = () => {
    const e: typeof errs = {};
    if (!f.firstName.trim()) e.firstName = 'First name is required';
    if (!f.surname.trim()) e.surname = 'Surname is required';
    if (!EMAIL.test(f.email.trim())) e.email = 'Enter a valid email address';
    if (!f.startupName.trim()) e.startupName = 'Startup name is required';
    setErrs(e); return !Object.keys(e).length;
  };

  async function confirm() {
    if (!slot) return;
    setBusy(true); setNotice('');
    try {
      const r = await fetch('/office-hours/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, start: slot.start, idempotencyKey: idem }) });
      const j = await r.json();
      if (r.ok) { router.push(`/confirmed/${j.id}?t=${encodeURIComponent(j.token)}`); return; }
      if (j.error === 'slot_unavailable') { setSlot(null); setStep(1); setRefresh((n) => n + 1); }
      if (j.error === 'invalid' && j.field) { setErrs({ [j.field]: j.message }); setStep(2); }
      setNotice(j.message || 'Something went wrong. Please try again.');
    } catch { setNotice('Network error — check your connection and try again.'); }
    setBusy(false);
  }

  const field = (k: keyof Fields, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, full = false) => (
    <div className={full ? 'full' : ''}>
      <label htmlFor={k} className="mono">{label}</label>
      <input id={k} value={f[k]} onChange={set(k)} aria-invalid={!!errs[k]} {...props} />
      {errs[k] && <div className="err">{errs[k]}</div>}
    </div>
  );

  return (
    <section className="card">
      <div className="steps mono">
        {['1 · Pick a time', '2 · Your details', '3 · Review'].map((t, i) => <span key={t} className={`step${step === i + 1 ? ' on' : step > i + 1 ? ' done' : ''}`}>{t}</span>)}
      </div>
      {notice && <div className="notice rise" role="alert">{notice}</div>}

      {step === 1 && <div className="rise">
        <h2>Choose a date and time</h2>
        <p className="sub">Only times when the host and every co-host are free are shown.</p>
        <SlotPicker selected={slot} onSelect={(s) => { setSlot(s); setNotice(''); }} refreshKey={refresh} />
        <div className="btns"><button className="btn" disabled={!slot} onClick={() => setStep(2)}>{slot ? `Continue with ${slot.label}` : 'Select a time to continue'}</button></div>
      </div>}

      {step === 2 && slot && <form className="rise" onSubmit={(e) => { e.preventDefault(); if (validate()) setStep(3); }} noValidate>
        <h2>Your details</h2>
        <p className="sub">{longDate(slot.start)} · {slot.label} WAT · 30 min</p>
        <div className="form">
          {field('firstName', 'First name', { autoComplete: 'given-name', required: true })}
          {field('surname', 'Surname', { autoComplete: 'family-name', required: true })}
          {field('email', 'Email address', { type: 'email', autoComplete: 'email', inputMode: 'email', required: true }, true)}
          {field('startupName', 'Startup name', { autoComplete: 'organization', required: true }, true)}
          <div className="full">
            <label htmlFor="notes" className="mono">Session topic or notes (optional)</label>
            <textarea id="notes" value={f.notes} onChange={set('notes')} maxLength={2000} placeholder="What would you like to cover? Progress, challenges, next milestones…" />
          </div>
        </div>
        <div className="btns"><button className="btn" type="submit">Review booking</button><button className="btn ghost" type="button" onClick={() => setStep(1)}>Change time</button></div>
      </form>}

      {step === 3 && slot && <div className="rise">
        <h2>Review and confirm</h2>
        <p className="sub">You, the host and the co-hosts will all receive the same Google Calendar invitation with a Google Meet link.</p>
        <div className="review">
          <div className="row"><span className="mono">Date</span><div>{longDate(slot.start)}</div></div>
          <div className="row"><span className="mono">Time</span><div>{slot.label} – {new Date(new Date(slot.start).getTime() + 30 * 60000).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' })}</div></div>
          <div className="row"><span className="mono">Duration</span><div>30 minutes · Google Meet</div></div>
          <div className="row"><span className="mono">Time zone</span><div>West Africa Time (Africa/Lagos)</div></div>
          <div className="row"><span className="mono">Founder</span><div>{f.firstName} {f.surname} · {f.email}</div></div>
          <div className="row"><span className="mono">Startup</span><div>{f.startupName}</div></div>
          {f.notes && <div className="row"><span className="mono">Notes</span><div style={{ whiteSpace: 'pre-wrap' }}>{f.notes}</div></div>}
        </div>
        <div className="btns">
          <button className="btn" onClick={confirm} disabled={busy}>{busy ? <><span className="spin" />Booking — checking calendars…</> : 'Confirm booking'}</button>
          <button className="btn ghost" onClick={() => setStep(2)} disabled={busy}>Edit details</button>
        </div>
      </div>}
    </section>
  );
}
