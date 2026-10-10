const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function findFreePort(start, end) {
  return new Promise((resolve, reject) => {
    const tryPort = port => {
      const tester = net.createServer();
      tester.once('error', () => {
        if (port >= end) { reject(new Error('no_free_port')); return; }
        tryPort(port + 1);
      });
      tester.once('listening', () => tester.close(() => resolve(port)));
      tester.listen(port, '127.0.0.1');
    };
    tryPort(start);
  });
}

function createServer() {
  return http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    const requested = path.join(ROOT, path.normalize(urlPath));
    if (!requested.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden');
      return;
    }

    fs.stat(requested, (statErr, stats) => {
      const filePath = !statErr && stats.isDirectory() ? path.join(requested, 'index.html') : requested;

      fs.readFile(filePath, (readErr, data) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache'
        }).end(data);
      });
    });
  });
}

if (require.main === module) {
  const server = createServer();
  findFreePort(PORT, PORT + 50)
    .then(port => {
      server.listen(port, '127.0.0.1', () => {
        console.log(`Mero Dev POS -> http://127.0.0.1:${port}`);
      });
    })
    .catch(() => {
      server.listen(0, '127.0.0.1', () => {
        console.log(`Mero Dev POS -> http://127.0.0.1:${server.address().port}`);
      });
    });

  server.on('error', err => {
    if (err.code !== 'EADDRINUSE') throw err;
  });
}

module.exports = { createServer, findFreePort, PORT };
