// Generates per-company prerendered HTML (company/<slug>.html) with company-specific
// <title>/og: tags, plus og-data.json for the card generator (build-previews.py).
// Run from this directory:  node build-previews.mjs   (then: python3 build-previews.py)
import fs from 'fs';

const ORIGIN = 'https://sevcp.sedc.gov.ng';

// Import the data module without a package.json by loading it as a data: URL (ESM).
const src = fs.readFileSync('sevcp-data.js', 'utf8');
const mod = await import('data:text/javascript,' + encodeURIComponent(src));
const CO = mod.CO;

const html = fs.readFileSync('index.html', 'utf8');
const START = '<!-- Static SEO';
const END = '<script src="./support.js">';
const iStart = html.indexOf(START);
const iEnd = html.indexOf(END);
if (iStart < 0 || iEnd < 0) throw new Error('Could not locate SEO block markers in index.html');
const head = html.slice(0, iStart);
const tail = html.slice(iEnd);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

fs.mkdirSync('company', { recursive: true });
const ogData = [];

for (const c of CO) {
  const title = `${c.name} — SEVCP Portfolio`;
  const desc = c.tagline;
  const url = `${ORIGIN}/company/${c.slug}`;
  const img = `${ORIGIN}/og/${c.slug}.jpg`;
  const block =
`<!-- Static SEO / social preview tags (per-company; crawlers don't run the JS that sets these live) -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SEVCP">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:secure_url" content="${img}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(c.name)} — SEVCP 2026 portfolio company">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${img}">
`;
  fs.writeFileSync(`company/${c.slug}.html`, head + block + tail);
  ogData.push({ slug: c.slug, name: c.name, tagline: c.tagline, sector: c.sector, state: c.state });
}

fs.writeFileSync('og-data.json', JSON.stringify(ogData, null, 2));
console.log(`Wrote ${CO.length} company/*.html files + og-data.json`);
