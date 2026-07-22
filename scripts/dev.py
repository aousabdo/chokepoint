#!/usr/bin/env python3
"""Dev server: SimpleHTTPRequestHandler + Cache-Control: no-store.

Plain `python3 -m http.server` sends only Last-Modified, so browsers apply
heuristic caching and serve stale ES modules/JSON for minutes after an edit.
Production (GitHub Pages) sends proper ETags; this is a dev-only concern.
"""
import os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5199))
    print(f'chokepoint dev server → http://localhost:{port} (no-store)')
    ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()
