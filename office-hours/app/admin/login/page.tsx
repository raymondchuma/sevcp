import { redirect } from 'next/navigation';
import { devLoginAllowed, getAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin sign in · SEVCP Office Hours', robots: { index: false } };

const ERRORS: Record<string, string> = {
  not_allowed: 'That Google account isn’t on the admin allowlist.',
  state: 'Sign-in expired. Please try again.',
  oauth: 'Google sign-in failed. Please try again.',
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdmin()) redirect('/admin');
  const { error } = await searchParams;
  return (
    <main>
      <section className="hero" style={{ maxWidth: 560, margin: '20px auto 80px' }}>
        <span className="eyebrow mono"><i />Admin</span>
        <h1 className="big">Office Hours dashboard</h1>
        <p>Sign in with an authorised Google account.</p>
        {error && <div className="notice">{ERRORS[error] || 'Sign-in failed.'}</div>}
        {!process.env.GOOGLE_CLIENT_ID && !devLoginAllowed() && <div className="notice">Google sign-in isn’t configured yet. Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to the Vercel project, then redeploy (see docs/SETUP.md).</div>}
        <div className="btns">
          {process.env.GOOGLE_CLIENT_ID && <a className="btn" href="/office-hours/api/auth/google/start?purpose=login">Sign in with Google</a>}
          {devLoginAllowed() && <form action="/office-hours/api/auth/dev-login" method="post"><button className="btn ghost">Local dev sign-in</button></form>}
        </div>
      </section>
    </main>
  );
}
