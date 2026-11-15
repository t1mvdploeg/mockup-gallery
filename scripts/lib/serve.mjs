import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

// Returns an absolute file path inside root, or null when the request must be a 404.
function resolveSafe(root, rawUrl) {
  let p;
  try {
    p = decodeURIComponent(rawUrl.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  if (p.includes('\0') || p.includes('\\')) return null;
  const segs = p.split('/').filter(Boolean);
  if (segs.some((s) => s.startsWith('.'))) return null;
  const abs = path.resolve(root, ...(segs.length ? segs : ['index.html']));
  const base = path.resolve(root);
  return abs.startsWith(base + path.sep) ? abs : null;
}

export function startServer(dir, port = 0) {
  const base = fs.realpathSync.native(dir);
  const server = http.createServer((req, res) => {
    // Block DNS rebinding: only our own loopback names are accepted.
    const host = String(req.headers.host ?? '').toLowerCase();
    const p = server.address().port;
    if (host !== `127.0.0.1:${p}` && host !== `localhost:${p}`) {
      res.writeHead(403);
      return res.end();
    }
    let file = resolveSafe(dir, req.url);
    try {
      if (file && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!file) throw new Error('nope');
      // .native expands Windows 8.3 names and symlinks; the real path must stay inside the gallery.
      const rel = path.relative(base, fs.realpathSync.native(file));
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('outside');
      if (rel.split(path.sep).some((s) => s.startsWith('.'))) throw new Error('dotfile');
      const body = fs.readFileSync(file);
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }),
    );
  });
}
