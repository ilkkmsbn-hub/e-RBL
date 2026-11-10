// Pratonton tempatan. API memerlukan environment GAS_WEB_APP_URL dan GAS_API_SECRET.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from '../relay/handler.mjs';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const port = Number(process.env.PORT || 8788);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };
http.createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://${incoming.headers.host || "localhost:" + port}`);
    if (url.pathname === '/api') {
      const request = new Request(url, { method: incoming.method, headers: incoming.headers, ...(incoming.method === 'POST' ? { body: incoming, duplex: 'half' } : {}) });
      const result = await handleApi(request, process.env);
      outgoing.writeHead(result.status, Object.fromEntries(result.headers));
      outgoing.end(Buffer.from(await result.arrayBuffer()));
      return;
    }
    const relative = decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root)) { outgoing.writeHead(403); outgoing.end(); return; }
    const bytes = await readFile(file);
    outgoing.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    outgoing.end(bytes);
  } catch (error) { outgoing.writeHead(404); outgoing.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`e-SO: http://localhost:${port}`));
