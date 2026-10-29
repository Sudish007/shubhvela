// Tiny static server for web/dist on 127.0.0.1, mirroring GitHub Pages project-site behaviour (audit tooling only):
// the site lives under the /shubhvela/ base path, directories resolve to index.html, unknown paths get dist/404.html
// with status 404, text assets are gzip-compressed when the client accepts it, Cache-Control is Pages' 10 minutes.
// Anything outside the base path (e.g. /robots.txt at the origin root) is a 404 like on sudish007.github.io.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DIST = path.resolve(HERE, '..', 'dist');
export const BASE_PATH = '/shubhvela/';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
const COMPRESS = new Set(['.html', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.svg']);

function resolveFile(urlPath) {
  if (!urlPath.startsWith(BASE_PATH)) return null;
  let rel = decodeURIComponent(urlPath.slice(BASE_PATH.length));
  if (rel.includes('..')) return null;
  let file = path.join(DIST, rel);
  if (rel === '' || rel.endsWith('/')) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return null;
  const st = fs.statSync(file);
  if (st.isDirectory()) {
    const idx = path.join(file, 'index.html');
    return fs.existsSync(idx) ? idx : null;
  }
  return file;
}

function send(req, res, file, status) {
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] || 'application/octet-stream';
  const body = fs.readFileSync(file);
  const headers = { 'Content-Type': type, 'Cache-Control': 'max-age=600', 'Access-Control-Allow-Origin': '*' };
  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (COMPRESS.has(ext) && acceptsGzip) {
    const gz = zlib.gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = gz.length;
    res.writeHead(status, headers);
    res.end(gz);
  } else {
    headers['Content-Length'] = body.length;
    res.writeHead(status, headers);
    res.end(body);
  }
}

/** Starts the server on an OS-assigned port; resolves { origin, baseUrl, close }. */
export function serveDist({ dist = DIST } = {}) {
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`no build at ${dist}; run npm run web:build first`);
  const notFound = path.join(dist, '404.html');
  const server = http.createServer((req, res) => {
    const urlPath = new URL(req.url, 'http://127.0.0.1').pathname;
    const file = resolveFile(urlPath);
    if (file) return send(req, res, file, 200);
    if (fs.existsSync(notFound)) return send(req, res, notFound, 404);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const origin = `http://127.0.0.1:${port}`;
      resolve({ origin, baseUrl: origin + BASE_PATH, port, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

/** Chromium shipped with the Playwright install under %LOCALAPPDATA%/ms-playwright (never downloads anything). */
export function playwrightChromium() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const dirs = fs.existsSync(root) ? fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort() : [];
  for (const d of dirs.reverse()) {
    for (const cand of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome']) {
      const p = path.join(root, d, cand);
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error(`no Playwright Chromium under ${root}; install is an owner step (disk check first)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  serveDist().then(({ baseUrl }) => console.log(`serving ${DIST} at ${baseUrl} (Ctrl+C to stop)`));
}
