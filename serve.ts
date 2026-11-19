// Tiny static server for local testing only (Node 22, stdlib only).
// Serves app/ at http://localhost:8080 — run `node serve.ts`, then open it.
// The entry itself needs no server: app/index.html opens from any static host.

import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'app');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ttf': 'font/ttf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const path = normalize(join(root, decodeURIComponent(req.url.split('?')[0])));
  if (!path.startsWith(root)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  const file = path.endsWith('/') ? join(path, 'index.html') : path;
  const stream = createReadStream(file);
  stream.on('open', () => {
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    stream.pipe(res);
  });
  stream.on('error', () => {
    res.writeHead(404);
    res.end('not found');
  });
});

server.listen(8080, () => {
  console.log('Vice City Cover Studio at http://localhost:8080');
});
