// server.js - Servidor Local Wi-Fi (Alternativa Node.js a wifi_vr_server.py)
// Soporta tanto archivos estáticos como los endpoints /vr, /api/info, /api/push, /api/bundle y /api/headtrack

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8090;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png'
};

const streamState = {
  active: false,
  seq: 0,
  lastPushTs: 0,
  fps: 25,
  frameDataUrl: null,
  telemetry: null,
  headtrack: { enabled: false, yaw: 0, pitch: 0, ts: 0 },
  clientsSeen: {}
};

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips.length ? ips : ['127.0.0.1'];
}

function sendJson(res, payload, status = 200) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const now = Date.now();
  if (streamState.active && now - streamState.lastPushTs > 3500) {
    streamState.active = false;
  }

  const cleanUrl = req.url.split('?')[0];

  if (req.method === 'GET' && cleanUrl === '/api/info') {
    const ips = getLocalIPs();
    const activeClients = Object.values(streamState.clientsSeen).filter((ts) => now - ts < 5000).length;
    return sendJson(res, {
      ok: true,
      port: PORT,
      ips,
      urls: ips.map((ip) => `http://${ip}:${PORT}/vr`),
      active: streamState.active,
      clientsCount: activeClients,
      headtrack: now - streamState.headtrack.ts < 2000 ? streamState.headtrack : { enabled: false, yaw: 0, pitch: 0 }
    });
  }

  if (req.method === 'GET' && cleanUrl === '/api/bundle') {
    const ip = req.socket.remoteAddress || 'client';
    streamState.clientsSeen[ip] = now;
    return sendJson(res, {
      active: streamState.active,
      seq: streamState.seq,
      fps: streamState.fps,
      frameDataUrl: streamState.active ? streamState.frameDataUrl : null,
      telemetry: streamState.telemetry
    });
  }

  if (req.method === 'POST' && (cleanUrl === '/api/push' || cleanUrl === '/api/headtrack')) {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      let data = {};
      try { data = JSON.parse(body || '{}'); } catch (e) {}

      if (cleanUrl === '/api/push') {
        streamState.active = !!data.active;
        streamState.lastPushTs = now;
        if (streamState.active) {
          if (data.frameDataUrl) {
            streamState.frameDataUrl = data.frameDataUrl;
            streamState.seq++;
          }
          if (data.telemetry) streamState.telemetry = data.telemetry;
          if (data.fps) streamState.fps = data.fps;
        } else {
          streamState.frameDataUrl = null;
        }
        const activeClients = Object.values(streamState.clientsSeen).filter((ts) => now - ts < 5000).length;
        return sendJson(res, {
          ok: true,
          seq: streamState.seq,
          clientsCount: activeClients,
          headtrack: now - streamState.headtrack.ts < 2000 ? streamState.headtrack : null
        });
      } else {
        streamState.headtrack = {
          enabled: true,
          yaw: Number(data.yaw || 0),
          pitch: Number(data.pitch || 0),
          ts: now
        };
        return sendJson(res, { ok: true });
      }
    });
    return;
  }

  const safePath = cleanUrl === '/' ? '/index.html' : (cleanUrl === '/vr' || cleanUrl === '/vr/') ? '/vr.html' : cleanUrl;
  const filePath = path.join(__dirname, safePath);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`USAR Rover Simulator + VR Wi-Fi Server running at http://localhost:${PORT}`);
});
