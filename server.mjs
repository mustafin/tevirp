// Только для локальной разработки: раздаёт статику. В проде это GitHub Pages.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT = Number(process.argv[2] || 8770);
const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/peerjs.min.js': ['peerjs.min.js', 'text/javascript'],
  '/icon.svg': ['icon.svg', 'image/svg+xml'],
  '/icon-180.png': ['icon-180.png', 'image/png'],
};

http.createServer(async (req, res) => {
  const f = FILES[new URL(req.url, 'http://x').pathname];
  if (!f) return res.writeHead(404).end('not found');
  res.writeHead(200, { 'Content-Type': f[1], 'Cache-Control': 'no-cache' });
  res.end(await readFile(path.join(DIR, f[0])));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
