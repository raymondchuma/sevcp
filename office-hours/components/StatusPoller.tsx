'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** While a booking is still being confirmed with Google, re-render the page until it settles. */
export default function StatusPoller({ id, token }: { id: string; token: string }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const r = await fetch(`/office-hours/api/bookings/${id}?t=${encodeURIComponent(token)}`, { cache: 'no-store' }).catch(() => null);
      const j = r && r.ok ? await r.json() : null;
      if ((j && j.status !== 'pending') || n > 40) { clearInterval(t); router.refresh(); }
    }, 3000);
    return () => clearInterval(t);
  }, [id, token, router]);
  return null;
}
