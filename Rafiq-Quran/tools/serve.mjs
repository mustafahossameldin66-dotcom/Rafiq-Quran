import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const PORT = Number(process.env.PORT) || 8080;

const MIMES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(root, reqPath.replace(/^\/+/, ''));
  
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIMES[ext] || 'application/octet-stream';
  
  res.writeHead(200, {
    'Content-Type': mime,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Rafiq Quran dev server running at: http://localhost:${PORT}/`);
});
