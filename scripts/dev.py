#!/usr/bin/env python3
"""Dev server: no-store caching + byte-range support.

- Cache-Control: no-store — plain `python3 -m http.server` sends only
  Last-Modified, so browsers apply heuristic caching and serve stale ES
  modules/JSON for minutes after an edit.
- Range requests — the PMTiles client reads the basemap via byte ranges;
  without 206 support it falls back to fetching the whole 33 MB archive.
Production (GitHub Pages) does both correctly; this mirrors it for dev.
"""
import os
import re
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

RANGE_RE = re.compile(r'bytes=(\d+)-(\d*)')


class DevHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def do_GET(self):
        m = RANGE_RE.match(self.headers.get('Range', ''))
        if not m:
            return super().do_GET()
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().do_GET()
        size = os.path.getsize(path)
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end or start >= size:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        with open(path, 'rb') as f:
            f.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5199))
    print(f'chokepoint dev server → http://localhost:{port} (no-store, ranges)')
    ThreadingHTTPServer(('', port), DevHandler).serve_forever()
