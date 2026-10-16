#!/usr/bin/env python3
"""Static dev server with no-cache + SPA fallback: serves index.html for
client-side routes (e.g. /company/<slug>, /portfolio, /about) so shared deep
links open cold. Real files (/img/..., /support.js, /sevcp-data.js) are served
normally. Usage:
    python3 serve.py [port] [directory]
"""
import json
import os
import sys
import urllib.request
from urllib.parse import quote
from functools import partial
from urllib.parse import urlparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


# Mirrors api/blog.js (the Vercel function) so /api/blog works locally.
SANITY_URL = "https://vm3u10aa.apicdn.sanity.io/v2024-01-01/data/query/production?query="
BLOG_QUERY = """*[_type == "blogPost" && defined(slug.current) && !(_id in path("drafts.**"))]
  | order(publishedAt desc) {
    title, "slug": slug.current, intro, publishedAt,
    "image": mainImage.asset->url,
    "author": author->name,
    "categories": categories[]->title,
    "words": length(string::split(pt::text(body), " ")),
    body[]{..., _type == "image" => {"url": asset->url}}
  }"""


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if urlparse(self.path).path == "/api/blog":
            try:
                with urllib.request.urlopen(SANITY_URL + quote(BLOG_QUERY), timeout=15) as r:
                    body = json.dumps({"posts": json.load(r).get("result") or []}).encode()
                code = 200
            except Exception as e:
                body, code = json.dumps({"posts": [], "error": str(e)}).encode(), 502
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        parsed = urlparse(self.path)
        p = parsed.path
        fs = self.translate_path(self.path)
        if not os.path.exists(fs) and not os.path.splitext(p)[1]:
            # cleanUrls parity: prefer a prerendered <path>.html, else SPA fallback.
            cand = self.translate_path(p.rstrip("/") + ".html")
            self.path = (p.rstrip("/") + ".html") if os.path.exists(cand) else "/index.html"
        return super().send_head()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4610
    directory = sys.argv[2] if len(sys.argv) > 2 else "."
    handler = partial(Handler, directory=directory)
    print(f"Serving {directory} on http://localhost:{port} (no-cache, SPA fallback)")
    ThreadingHTTPServer(("", port), handler).serve_forever()
