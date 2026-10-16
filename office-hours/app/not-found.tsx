import Link from 'next/link';
export default function NotFound() {
  return <main><section className="hero"><span className="eyebrow mono"><i />Not found</span><h1 className="big">This link isn’t valid.</h1><p>It may be mistyped or expired. You can book a new session below.</p><div className="btns"><Link className="btn" href="/">Book office hours</Link></div></section></main>;
}
