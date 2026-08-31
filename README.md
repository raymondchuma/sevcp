# SEVCP Website

Public site for the South East Venture Capital Program (SEVCP), an initiative of
the South East Development Commission.

## Structure

| File / dir | What it is |
|---|---|
| `index.html` | The live site (v2). **Generated** from `SEVCP Website v2.dc.html` — see below. |
| `SEVCP Website v2.dc.html` | Editable source (Claude Design bundle). Edit this, then regenerate `index.html`. |
| `support.js` | Claude Design runtime that renders the `.dc.html` (loads React/Babel from CDN). |
| `image-slot.js` | Custom element for the croppable photo slots. |
| `image-slots.state.json` | Saved crops/positions for the image slots. |
| `sevcp-data.js` | Portfolio data — the 25 companies in the 2026 cohort. |
| `img/`, `uploads/` | Photography and logos. |
| `vercel.json` | SPA rewrite so client-side routes resolve on Vercel. |
| `serve.py` | Local dev server (no-cache + SPA fallback). |
| `v1.html` | The previous single-file version of the site, kept for reference. |

## Editing

`index.html` is a copy of `SEVCP Website v2.dc.html`. After editing the `.dc.html`,
regenerate the served file:

```bash
cp "SEVCP Website v2.dc.html" index.html
```

## Run locally

```bash
python3 serve.py 8000 .
```

Then open http://localhost:8000 . Must be served over HTTP (the app uses dynamic
`import`/`fetch`, which don't work from `file://`).

## Routing

Client-side, path-based, shareable URLs — e.g. `/company/<slug>` (`/company/kira-ai`),
`/portfolio` (with filters like `?state=Enugu&sector=FinTech`), `/about`, `/pitch`,
`/blog`, `/founder-school`, `/events/<slug>`, `/partners`.

## Deploy (Vercel)

Static deployment — no build step (framework preset: **Other**). `vercel.json`
rewrites unknown paths to `index.html` so a shared deep link opens cold.
