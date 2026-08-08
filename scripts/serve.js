// ===== STATIC SERVER =====
// Zero-dependency static file server for Railway. Serves the repo root.
// Run: PORT=8123 node scripts/serve.js
var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var PORT = process.env.PORT || 8080;

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf'
};

function isBlocked(rel) {
  // dotfiles (.env, .git) and node_modules are never served
  var parts = rel.split('/');
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === '' || parts[i] === '.') continue;
    if (parts[i].charAt(0) === '.' || parts[i] === 'node_modules') return true;
  }
  return false;
}

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function serveFile(res, filePath) {
  var ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, function (err, data) {
    if (err) return send(res, 404, 'Not Found');
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
}

http.createServer(function (req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');
  var urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    return send(res, 400, 'Bad Request');
  }
  // NUL bytes crash fs.stat synchronously — reject before touching the filesystem
  if (urlPath.indexOf('\0') !== -1) return send(res, 400, 'Bad Request');
  var rel = urlPath.replace(/^\/+/, '');
  if (isBlocked(rel)) return send(res, 404, 'Not Found');
  var filePath = path.normalize(path.join(ROOT, rel));
  if (filePath !== ROOT && filePath.indexOf(ROOT + path.sep) !== 0) {
    return send(res, 404, 'Not Found'); // path-traversal guard
  }
  fs.stat(filePath, function (err, stat) {
    if (err || !stat) return send(res, 404, 'Not Found');
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fs.stat(filePath, function (err2, stat2) {
        if (err2 || !stat2 || !stat2.isFile()) return send(res, 404, 'Not Found');
        serveFile(res, filePath);
      });
    } else {
      serveFile(res, filePath);
    }
  });
  console.log(new Date().toISOString() + ' ' + req.method + ' ' + req.url + ' -> ' + filePath);
}).listen(PORT, function () {
  console.log('Skarn static server listening on port ' + PORT);
});