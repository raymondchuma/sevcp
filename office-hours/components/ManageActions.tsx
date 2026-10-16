'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SlotPicker, { PickedSlot } from './SlotPicker';

export default function ManageActions({ id, token, canChange }: { id: string; token: string; canChange: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'reschedule' | 'cancel'>('idle');
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [refresh, setRefresh] = useState(0);

  async function post(path: string, body: object, ok: string) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/office-hours/api/bookings/${id}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, ...body }) });
      const j = await r.json();
      if (r.ok) { setMsg({ ok: true, text: ok }); setMode('idle'); setSlot(null); router.refresh(); }
      else { setMsg({ ok: false, text: j.message || 'Something went wrong.' }); if (j.error === 'slot_unavailable') { setSlot(null); setRefresh((n) => n + 1); } }
    } catch { setMsg({ ok: false, text: 'Network error — please try again.' }); }
    setBusy(false);
  }

  if (!canChange) return msg ? <div className={`notice${msg.ok ? ' ok' : ''}`}>{msg.text}</div> : null;
  return (
    <div>
      {msg && <div className={`notice rise${msg.ok ? ' ok' : ''}`} role="status">{msg.text}</div>}
      {mode === 'idle' && <div className="btns">
        <button className="btn" onClick={() => setMode('reschedule')}>Reschedule</button>
        <button className="btn danger" onClick={() => setMode('cancel')}>Cancel booking</button>
      </div>}
      {mode === 'cancel' && <div className="rise" style={{ marginTop: 18 }}>
        <div className="empty">Cancel this session? Everyone on the invitation will be notified and the time will be released.</div>
        <div className="btns">
          <button className="btn danger" disabled={busy} onClick={() => post('cancel', {}, 'Your booking has been cancelled. Everyone on the invitation has been notified.')}>{busy ? <><span className="spin" />Cancelling…</> : 'Yes, cancel it'}</button>
          <button className="btn ghost" disabled={busy} onClick={() => setMode('idle')}>Keep my booking</button>
        </div>
      </div>}
      {mode === 'reschedule' && <div className="rise" style={{ marginTop: 22 }}>
        <h2>Pick a new time</h2>
        <p className="sub">Your calendar invitation and Meet link stay the same — only the time changes.</p>
        <SlotPicker selected={slot} onSelect={setSlot} ignoreBookingId={id} refreshKey={refresh} />
        <div className="btns">
          <button className="btn" disabled={!slot || busy} onClick={() => slot && post('reschedule', { start: slot.start }, 'Rescheduled. Everyone on the invitation has been sent the new time.')}>{busy ? <><span className="spin" />Moving your session…</> : slot ? `Move to ${slot.label}` : 'Select a new time'}</button>
          <button className="btn ghost" disabled={busy} onClick={() => setMode('idle')}>Back</button>
        </div>
      </div>}
    </div>
  );
}
