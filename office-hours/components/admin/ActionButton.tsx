'use client';
import { useState, useTransition } from 'react';

type R = { ok: boolean; message: string };
/** Runs a server action and shows its result inline. */
export default function ActionButton({ action, label, confirm, className = 'btn ghost sm' }: { action: () => Promise<R>; label: string; confirm?: string; className?: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<R | null>(null);
  return (
    <span className="act">
      <button className={className} disabled={pending} onClick={() => { if (confirm && !window.confirm(confirm)) return; start(async () => setRes(await action())); }}>{pending ? <span className="spin" /> : null}{label}</button>
      {res && <span className={`actmsg ${res.ok ? 'good' : 'bad'}`}>{res.message}</span>}
    </span>
  );
}
