import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

export function createStaticServer(rootDir = ROOT_DIR) {
  const server = http.createServer((req, res) => {
    // Enable CORS for testing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      return;
    }

    // Strip query string and decode URL path
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request: Malformed URI');
      return;
    }
    let relativePath = urlPath === '/' ? '/index.html' : urlPath;
    const safeRoot = path.normalize(path.resolve(rootDir));
    const filePath = path.normalize(path.join(safeRoot, relativePath));

    // Security: prevent directory traversal outside rootDir
    const safePrefix = safeRoot.endsWith(path.sep) ? safeRoot : safeRoot + path.sep;
    if (filePath !== safeRoot && !filePath.startsWith(safePrefix)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`File Not Found: ${relativePath}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileSize = stats.size;

      // Handle HTTP Range requests for audio/video media streaming
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
        if (!match || (!match[1] && !match[2])) {
          res.writeHead(416, {
            'Content-Range': `bytes */${fileSize}`,
            'Content-Type': contentType
          });
          res.end();
          return;
        }

        let start;
        let end;

        if (match[1] === '') {
          // Suffix byte range: bytes=-500 (last 500 bytes)
          const suffixLen = parseInt(match[2], 10);
          if (suffixLen === 0) {
            res.writeHead(416, {
              'Content-Range': `bytes */${fileSize}`,
              'Content-Type': contentType
            });
            res.end();
            return;
          }
          start = Math.max(0, fileSize - suffixLen);
          end = fileSize - 1;
        } else if (match[2] === '') {
          // Open-ended range: bytes=500-
          start = parseInt(match[1], 10);
          end = fileSize - 1;
        } else {
          // Explicit range: bytes=0-100
          start = parseInt(match[1], 10);
          end = parseInt(match[2], 10);
        }

        if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
          res.writeHead(416, {
            'Content-Range': `bytes */${fileSize}`,
            'Content-Type': contentType
          });
          res.end();
          return;
        }

        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType
        });

        if (req.method === 'HEAD') {
          res.end();
        } else {
          fileStream.pipe(res);
        }
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes'
        });

        if (req.method === 'HEAD') {
          res.end();
        } else {
          fs.createReadStream(filePath).pipe(res);
        }
      }
    });
  });

  return {
    server,
    start: (port = 0, host = '127.0.0.1') => {
      return new Promise((resolve, reject) => {
        server.listen(port, host, () => {
          const address = server.address();
          const actualPort = typeof address === 'object' && address ? address.port : port;
          const baseUrl = `http://${host}:${actualPort}`;
          resolve({ server, port: actualPort, baseUrl });
        });
        server.on('error', reject);
      });
    },
    stop: () => {
      return new Promise((resolve) => {
        server.close(resolve);
      });
    }
  };
}

export default createStaticServer;
