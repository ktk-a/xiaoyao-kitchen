// 簡易 dev server：serve apps/xiaoyao-kitchen 根目錄的靜態檔案。
// bun run tools/serve.js [port]

import { serve } from 'bun';
import { join, extname } from 'node:path';
import { existsSync, statSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.argv[2] ?? 3030);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
};

serve({
  port: PORT,
  development: false,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = join(ROOT, path);
    if (!filePath.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return new Response('not found', { status: 404 });
    }
    const ct = MIME[extname(filePath)] ?? 'application/octet-stream';
    return new Response(Bun.file(filePath), { headers: { 'Content-Type': ct } });
  },
});
console.log(`http://localhost:${PORT}/`);
