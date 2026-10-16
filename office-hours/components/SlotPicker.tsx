'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface PickedSlot { start: string; label: string; day: string }
interface Avail { ok: boolean; message?: string; timezone: string; duration: number; firstDay: string; lastDay: string; days: Record<string, { start: string; label: string }[]> }

const BASE = '/office-hours';
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const monthName = (y: number, m: number) => new Date(Date.UTC(y, m, 15)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const longDay = (day: string) => new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export default function SlotPicker({ selected, onSelect, ignoreBookingId, refreshKey = 0 }: { selected: PickedSlot | null; onSelect: (s: PickedSlot) => void; ignoreBookingId?: string; refreshKey?: number }) {
  const today = new Date();
  const [ym, setYm] = useState<[number, number]>([today.getFullYear(), today.getMonth()]);
  const [data, setData] = useState<Avail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [day, setDay] = useState<string | null>(selected?.day || null);
  const viewerTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const load = useCallback(async () => {
    setLoading(true); setFailed('');
    const [y, m] = ym;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    try {
      const qs = new URLSearchParams({ from: iso(y, m, 1), to: iso(y, m, last) });
      if (ignoreBookingId) qs.set('ignore', ignoreBookingId);
      const r = await fetch(`${BASE}/api/availability?${qs}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok && !j.timezone) throw new Error(j.message || 'Could not load availability');
      setData(j);
      // Jump to the first month with availability on first load.
      const firstAvail = Object.keys(j.days || {}).sort()[0];
      setDay((d) => (d && j.days?.[d] ? d : firstAvail || null));
    } catch (e) { setFailed((e as Error).message); }
    finally { setLoading(false); }
  }, [ym, ignoreBookingId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const [y, m] = ym;
  const first = new Date(Date.UTC(y, m, 1)), offset = (first.getUTCDay() + 6) % 7, count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const todayKey = iso(today.getFullYear(), today.getMonth(), today.getDate());
  const canPrev = data ? iso(y, m, 1) > data.firstDay.slice(0, 7) + '-01' : false;
  const canNext = data ? iso(y, m, count) < data.lastDay : true;
  const move = (k: number) => { const d = new Date(Date.UTC(y, m + k, 1)); setYm([d.getUTCFullYear(), d.getUTCMonth()]); setDay(null); };
  const slots = (day && data?.days?.[day]) || [];
  const localHint = (s: string) => (data && viewerTz !== data.timezone ? new Date(s).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: viewerTz }) + ' your time' : '');

  if (data && !data.ok) return <div className="notice">{data.message} If this persists, email <a href="mailto:sevcp@sedc.gov.ng">sevcp@sedc.gov.ng</a>.</div>;
  return (
    <div className="cal">
      <div>
        <div className="calhead">
          <button className="nav" onClick={() => move(-1)} disabled={!canPrev || loading} aria-label="Previous month">‹</button>
          <b>{monthName(y, m)}</b>
          <button className="nav" onClick={() => move(1)} disabled={!canNext || loading} aria-label="Next month">›</button>
        </div>
        <div className="dow mono">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="days" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
          {Array.from({ length: offset }).map((_, i) => <span key={'e' + i} />)}
          {Array.from({ length: count }).map((_, i) => {
            const key = iso(y, m, i + 1); const avail = !!data?.days?.[key]?.length;
            return (
              <button key={key} className={`day${avail ? ' avail' : ''}${day === key ? ' sel' : ''}${key === todayKey ? ' today' : ''}`} disabled={!avail}
                aria-label={`${longDay(key)}${avail ? `, ${data!.days[key].length} times available` : ', unavailable'}`} onClick={() => setDay(key)}>{i + 1}</button>
            );
          })}
        </div>
      </div>
      <div className="slots">
        {failed ? <div className="notice">{failed} <button className="btn ghost" style={{ padding: '6px 12px', marginLeft: 6 }} onClick={load}>Retry</button></div>
          : loading && !data ? <div className="empty"><span className="spin" />Checking the team’s calendars…</div>
          : !day ? <div className="empty">No open times this month. Try the next month{data && Object.keys(data.days).length === 0 ? '' : ''}.</div>
          : <>
            <h3>{longDay(day)}</h3>
            <p className="tz mono">Times in West Africa Time ({data?.timezone}) · {data?.duration} min</p>
            {slots.length ? <div className="slotlist" role="listbox" aria-label="Available times">
              {slots.map((s) => (
                <button key={s.start} role="option" aria-selected={selected?.start === s.start} className={`slot${selected?.start === s.start ? ' sel' : ''}`} onClick={() => onSelect({ ...s, day })}>
                  {s.label}{localHint(s.start) && <small>{localHint(s.start)}</small>}
                </button>
              ))}
            </div> : <div className="empty">No times left on this date. Please pick another day.</div>}
          </>}
      </div>
    </div>
  );
}
