#!/usr/bin/env python3
"""Static dev server with no-cache + SPA fallback: serves index.html for
client-side routes (e.g. /company/<slug>, /portfolio, /about) so shared deep
links open cold. Real files (/img/..., /support.js, /sevcp-data.js) are served
normally. Usage:
    python3 serve.py [port] [directory]
"""
import os
import sys
from functools import partial
from urllib.parse import urlparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        parsed = urlparse(self.path)
        fs = self.translate_path(self.path)
        # Extensionless path that isn't a real file -> a client-side route.
        if not os.path.exists(fs) and not os.path.splitext(parsed.path)[1]:
            self.path = "/index.html"
        return super().send_head()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4610
    directory = sys.argv[2] if len(sys.argv) > 2 else "."
    handler = partial(Handler, directory=directory)
    print(f"Serving {directory} on http://localhost:{port} (no-cache, SPA fallback)")
    ThreadingHTTPServer(("", port), handler).serve_forever()
