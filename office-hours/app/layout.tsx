import type { Metadata } from 'next';
import { Outfit, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'SEVCP Office Hours',
  description: 'Book a 30-minute session with the South East Venture Capital Program team.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${mono.variable}`}>
      <body>
        <div className="stripe" aria-hidden><span style={{ background: '#6ACDDD' }} /><span style={{ background: '#E86642' }} /><span style={{ background: '#CAFC44' }} /><span style={{ background: '#6ACDDD' }} /><span style={{ background: '#237922' }} /></div>
        <div className="wrap">
          <header className="top">
            {/* Plain <a>: "/" is the main SEVCP site, outside this app's basePath. */}
            <a className="brand" href="/"><img className="sevcp" src="/office-hours/sevcp-logo.svg" alt="South East Venture Capital Program" /></a>
            <a className="back" href="/">← Back to sevcp.sedc.gov.ng</a>
          </header>
          {children}
          <footer className="foot">
            <span>An initiative of the South East Development Commission</span>
            <span>Questions? <a href="mailto:sevcp@sedc.gov.ng">sevcp@sedc.gov.ng</a></span>
          </footer>
        </div>
      </body>
    </html>
  );
}
