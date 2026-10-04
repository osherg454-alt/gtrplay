// GT Race online server: static file host + WebSocket room relay.
//   npm install      (once)
//   npm start        -> http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 8;
const rooms = new Map();   // code -> { code, hostCid, cfg, players: Map(cid -> {cid,name,car,ws}), hostTimer }

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/' || url === '/play.html' || url === '/index.html') {
    fs.readFile(path.join(__dirname, 'play.html'), (err, buf) => {
      if (err) { res.writeHead(500); res.end('play.html missing - rebuild the bundle'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  } else { res.writeHead(404); res.end('not found'); }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

const clean = (s, n) => String(s == null ? '' : s).replace(/[^\w \-.]/g, '').trim().slice(0, n);
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };

function roomInfo(room) {
  return {
    t: 'room', code: room.code, hostCid: room.hostCid, cfg: room.cfg,
    players: [...room.players.values()].map((p) => ({ id: p.cid, name: p.name, car: p.car })),
  };
}
function broadcast(room, o, except) {
  const s = JSON.stringify(o);
  for (const p of room.players.values()) if (p.ws !== except && p.ws.readyState === 1) p.ws.send(s);
}
function pushRoom(room) { broadcast(room, roomInfo(room)); }

function leave(ws) {
  const room = ws.room; if (!room) return;
  const p = room.players.get(ws.cid);
  if (p && p.ws === ws) {
    room.players.delete(ws.cid);
    broadcast(room, { t: 'left', id: ws.cid });
    if (room.players.size === 0) { clearTimeout(room.hostTimer); setTimeout(() => { if (room.players.size === 0) rooms.delete(room.code); }, 15000); }
    else if (room.hostCid === ws.cid) {
      // give the host a few seconds to come back (page reload on map change) before passing the crown on
      clearTimeout(room.hostTimer);
      room.hostTimer = setTimeout(() => {
        if (!room.players.has(room.hostCid)) { room.hostCid = room.players.keys().next().value; pushRoom(room); }
      }, 8000);
      pushRoom(room);
    } else pushRoom(room);
  }
  ws.room = null;
}

wss.on('connection', (ws) => {
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (data) => {
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'join') {
      const code = clean(m.room, 8).toUpperCase(), cid = clean(m.cid, 24);
      if (!code || !cid) return send(ws, { t: 'err', msg: 'BAD ROOM CODE' });
      leave(ws);
      let room = rooms.get(code);
      if (!room) {
        room = { code, hostCid: cid, cfg: { map: clean(m.map, 16) || 'riviera', laps: Math.max(1, Math.min(10, m.laps | 0 || 3)) }, players: new Map(), hostTimer: null };
        rooms.set(code, room);
      }
      const old = room.players.get(cid);
      if (!old && room.players.size >= MAX_PLAYERS) return send(ws, { t: 'err', msg: 'ROOM FULL' });
      if (old && old.ws !== ws) { old.ws.room = null; try { old.ws.close(); } catch (e) { /* gone */ } }
      if (cid === room.hostCid) clearTimeout(room.hostTimer);
      ws.cid = cid; ws.room = room;
      room.players.set(cid, { cid, name: clean(m.name, 14) || 'PLAYER', car: m.car | 0, ws });
      send(ws, { t: 'welcome', id: cid });
      pushRoom(room);
      return;
    }
    const room = ws.room; if (!room) return;
    if (m.t === 'cfg' && ws.cid === room.hostCid) {
      room.cfg = { map: clean(m.map, 16) || room.cfg.map, laps: Math.max(1, Math.min(10, m.laps | 0 || room.cfg.laps)) };
      pushRoom(room);
    } else if (m.t === 'car') {
      const p = room.players.get(ws.cid); if (p) { p.car = m.car | 0; pushRoom(room); }
    } else if (m.t === 'start' && ws.cid === room.hostCid) {
      broadcast(room, { t: 'start', goAt: 5.4 + Math.random() * 1.2, ids: [...room.players.keys()] });
    } else if (m.t === 's') {
      m.id = ws.cid; broadcast(room, m, ws);
    }
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});

setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 15000);

function listen(port) {
  server.once('error', (e) => { if (e.code === 'EADDRINUSE' && port < Number(PORT) + 20) listen(port + 1); else throw e; });
  server.listen(port, () => {
    console.log(`GT Race online server running: http://localhost:${port}`);
    console.log('Friends on the same Wi-Fi can join with http://<your-LAN-IP>:' + port);
    server.emit('ready', port);
  });
}
listen(Number(PORT));
module.exports = server;
