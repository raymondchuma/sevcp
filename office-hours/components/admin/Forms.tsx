'use client';
import { useActionState, useState, useTransition } from 'react';
import { listCalendars, saveSettings, setBookingCalendar, testAccess } from '@/lib/admin-actions';
import SlotPicker, { PickedSlot } from '../SlotPicker';
import { adminReschedule } from '@/lib/admin-actions';

type R = { ok: boolean; message: string } | null;
const Msg = ({ r }: { r: R }) => (r ? <div className={`notice rise${r.ok ? ' ok' : ''}`} style={{ marginTop: 14 }}>{r.message}</div> : null);
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']] as const;

export function SettingsForm({ s }: { s: { timezone: string; calendar_id: string; appointment_duration_minutes: number; minimum_notice_hours: number; maximum_booking_days: number; maximum_bookings_per_day: number; buffer_minutes: number; availability_rules: Record<string, [string, string][]> } }) {
  const [r, act, pending] = useActionState(saveSettings, null);
  const num = (name: string, label: string, v: number) => <div><label className="mono" htmlFor={name}>{label}</label><input id={name} name={name} type="number" defaultValue={v} required /></div>;
  return (
    <form action={act}>
      <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
        {num('duration', 'Duration (min)', s.appointment_duration_minutes)}
        {num('perDay', 'Max bookings / day', s.maximum_bookings_per_day)}
        {num('notice', 'Minimum notice (hours)', s.minimum_notice_hours)}
        {num('maxDays', 'Booking window (days)', s.maximum_booking_days)}
        {num('buffer', 'Buffer after (min)', s.buffer_minutes)}
        <div><label className="mono" htmlFor="timezone">Time zone</label><input id="timezone" name="timezone" defaultValue={s.timezone} required /></div>
        <div className="full"><label className="mono" htmlFor="calendar_id">Calendar ID (events are created here)</label><input id="calendar_id" name="calendar_id" defaultValue={s.calendar_id} required /></div>
      </div>
      <div className="hours">
        {DAYS.map(([k, name]) => {
          const w = s.availability_rules[k]?.[0];
          return (
            <div key={k} className="hourrow">
              <label className="chk"><input type="checkbox" name={`${k}_open`} defaultChecked={!!w} /> {name}</label>
              <input name={`${k}_from`} type="time" defaultValue={w?.[0] || '11:00'} aria-label={`${name} start`} />
              <span>to</span>
              <input name={`${k}_to`} type="time" defaultValue={w?.[1] || '15:00'} aria-label={`${name} end`} />
            </div>
          );
        })}
      </div>
      <div className="btns"><button className="btn" disabled={pending}>{pending ? <><span className="spin" />Saving…</> : 'Save rules'}</button></div>
      <Msg r={r} />
    </form>
  );
}

export function CalendarPicker({ current }: { current: string }) {
  const [pending, start] = useTransition();
  const [cals, setCals] = useState<{ id: string; summary: string; primary: boolean }[] | null>(null);
  const [r, setR] = useState<R>(null);
  return (
    <div style={{ marginTop: 12 }}>
      {!cals ? <button className="btn ghost sm" disabled={pending} onClick={() => start(async () => { const x = await listCalendars(); if (x.calendars) setCals(x.calendars); else setR(x); })}>{pending ? <span className="spin" /> : null}Change booking calendar</button>
        : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select defaultValue={current} id="calpick" aria-label="Booking calendar">{cals.map((c) => <option key={c.id} value={c.id}>{c.summary}{c.primary ? ' (primary)' : ''}</option>)}</select>
          <button className="btn sm" disabled={pending} onClick={() => start(async () => setR(await setBookingCalendar((document.getElementById('calpick') as HTMLSelectElement).value)))}>Save</button>
        </div>}
      <Msg r={r} />
    </div>
  );
}

export function TestAccess() {
  const [pending, start] = useTransition();
  const [r, setR] = useState<Awaited<ReturnType<typeof testAccess>> | null>(null);
  return (
    <div>
      <button className="btn lime" disabled={pending} onClick={() => start(async () => setR(await testAccess()))}>{pending ? <><span className="spin" />Checking calendars…</> : 'Test calendar access'}</button>
      {r && <div className={`notice rise${r.ok ? ' ok' : ''}`} style={{ marginTop: 14 }}>
        <b>{r.message}</b>
        {r.rows && <ul className="checks">{r.rows.map((x) => <li key={x.email}><span>{x.ok ? '✓' : '✕'}</span>{x.name} <small>({x.role}, {x.email})</small> — {x.detail}</li>)}</ul>}
      </div>}
    </div>
  );
}

export function AdminReschedule({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [pending, start] = useTransition();
  const [r, setR] = useState<R>(null);
  if (!open) return <button className="btn ghost sm" onClick={() => setOpen(true)}>Reschedule</button>;
  return (
    <div className="resched rise">
      <SlotPicker selected={slot} onSelect={setSlot} ignoreBookingId={id} />
      <div className="btns">
        <button className="btn sm" disabled={!slot || pending} onClick={() => slot && start(async () => { const x = await adminReschedule(id, slot.start); setR(x); if (x.ok) setOpen(false); })}>{pending ? <span className="spin" /> : null}{slot ? `Move to ${slot.label}` : 'Pick a time'}</button>
        <button className="btn ghost sm" onClick={() => setOpen(false)}>Close</button>
      </div>
      <Msg r={r} />
    </div>
  );
}
