import Booker from '@/components/Booker';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { hoursSummary } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const s = await getSettings(await db());
  return (
    <main>
      <section className="hero">
        <span className="eyebrow mono"><i />South East Venture Capital Program</span>
        <h1>SEVCP Office Hours</h1>
        <p>Book a session with the South East Venture Capital Program team to discuss your startup&rsquo;s progress, review existing milestones, and establish new milestones for your next phase of growth.</p>
        <p>Whether you need guidance on your business strategy, support navigating the program, or help defining clear, actionable goals, use this session to align on priorities, address challenges, and agree on the next steps to move your startup forward.</p>
        <div className="facts">
          <span className="fact">{s.appointment_duration_minutes} minutes</span><span className="fact">Google Meet</span><span className="fact">{hoursSummary(s.availability_rules)} WAT</span><span className="fact">No account needed</span>
        </div>
      </section>
      <div className="grid">
        <Booker />
        <aside className="aside">
          <h3>Come prepared with</h3>
          <ul>
            <li><b>01</b>An update on your progress since your last milestone.</li>
            <li><b>02</b>Your key challenges right now.</li>
            <li><b>03</b>Proposed priorities for the next milestone period.</li>
          </ul>
          <div className="meta">
            After booking you&rsquo;ll receive a Google Calendar invitation (with the Meet link) from the SEVCP team. Use the link in the invitation or on your confirmation page to cancel or reschedule.<br /><br />
            Questions? <a href="mailto:sevcp@sedc.gov.ng">sevcp@sedc.gov.ng</a>
          </div>
        </aside>
      </div>
    </main>
  );
}
