const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me-admin-token';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
const DATA_DIR = path.join(__dirname, 'data');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RE = /^MERO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const PLANS = { basic: { devices: 1, label: 'أساسي', price: 4900 }, pro: { devices: 1, label: 'احترافي', price: 9900 }, enterprise: { devices: 10, label: 'مؤسسات', price: 7400 } };

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveJSON(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

let keys = loadJSON(KEYS_FILE, []);
let orders = loadJSON(ORDERS_FILE, []);

function checksum(head) {
  let sum = 0;
  [...head].forEach((c, i) => { sum += c.charCodeAt(0) * (i + 7); });
  let h = sum % 1679616;
  let out = '';
  for (let i = 0; i < 4; i++) { out = ALPHA[h % 36] + out; h = Math.floor(h / 36); }
  return out;
}

function generateKey() {
  const chars = Array.from({ length: 8 }, () => ALPHA[crypto.randomInt(36)]);
  const head = chars.join('');
  return `MERO-${head.slice(0, 4)}-${head.slice(4)}-${checksum(head)}`;
}

function findKey(key) {
  const k = String(key || '').trim().toUpperCase();
  return { k, row: keys.find(x => x.key === k) };
}

function issue(count, plan, note) {
  const made = [];
  for (let i = 0; i < count; i++) {
    const key = generateKey();
    const row = {
      key, plan: PLANS[plan] ? plan : 'basic',
      maxDevices: (PLANS[plan] || PLANS.basic).devices,
      devices: [], revokedDevices: [], note: note || '', status: 'active',
      createdAt: new Date().toISOString()
    };
    keys.push(row);
    made.push(row);
  }
  saveJSON(KEYS_FILE, keys);
  return made;
}

function json(res, code, body) {
  const origin = ALLOWED_ORIGINS.includes('*') ? '*' : (ALLOWED_ORIGINS[0] || '*');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => {
      raw += c;
      if (raw.length > 1e6) { reject(new Error('payload too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function isAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-admin-token'];
  return Boolean(token) && token === ADMIN_TOKEN;
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const route = `${req.method} ${url.pathname}`;
  const quiet = url.pathname === '/health';

  res.on('finish', () => {
    if (quiet) return;
    console.log(`${new Date().toISOString()} ${route} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });

  try {
    if (req.method === 'OPTIONS') return json(res, 204, {});
    if (req.url === '/health') return json(res, 200, { ok: true, keys: keys.length, orders: orders.length });

    if (route === 'POST /activate') {
      const body = await readBody(req);
      const { k, row } = findKey(body.key);
      if (!RE.test(k) || !row) return json(res, 404, { ok: false, error: 'key_not_found' });
      if (row.status !== 'active') return json(res, 403, { ok: false, error: 'key_revoked' });
      if (!body.deviceId) return json(res, 400, { ok: false, error: 'device_required' });

      const existing = row.devices.find(d => d.id === body.deviceId);
      if (existing) existing.lastSeen = new Date().toISOString();
      else {
        if (row.devices.length >= row.maxDevices) {
          return json(res, 409, { ok: false, error: 'device_limit_reached', maxDevices: row.maxDevices });
        }
        if ((row.revokedDevices || []).some(d => d.id === body.deviceId)) {
          return json(res, 403, { ok: false, error: 'device_deactivated' });
        }
        row.devices.push({ id: body.deviceId, name: body.deviceName || null, activatedAt: new Date().toISOString(), lastSeen: new Date().toISOString() });
      }

      saveJSON(KEYS_FILE, keys);
      return json(res, 200, {
        ok: true, plan: row.plan, maxDevices: row.maxDevices,
        usedDevices: row.devices.length, expiresAt: row.expiresAt || null
      });
    }

    if (route === 'POST /verify') {
      const body = await readBody(req);
      const { k, row } = findKey(body.key);
      if (!RE.test(k) || !row) return json(res, 404, { ok: false, error: 'key_not_found' });
      if (row.status !== 'active') return json(res, 403, { ok: false, error: 'key_revoked' });
      const bound = row.devices.some(d => d.id === body.deviceId);
      if (!bound) return json(res, 403, { ok: false, error: 'device_not_activated' });
      return json(res, 200, { ok: true, plan: row.plan, expiresAt: row.expiresAt || null });
    }

    if (route === 'POST /deactivate') {
      const body = await readBody(req);
      const { k, row } = findKey(body.key);
      if (!RE.test(k) || !row) return json(res, 404, { ok: false, error: 'key_not_found' });
      row.revokedDevices = row.revokedDevices || [];
      const idx = row.devices.findIndex(d => d.id === body.deviceId);
      if (idx >= 0) {
        const [dev] = row.devices.splice(idx, 1);
        if (!row.revokedDevices.some(d => d.id === dev.id)) {
          row.revokedDevices.push({ ...dev, deactivatedAt: new Date().toISOString() });
        }
        saveJSON(KEYS_FILE, keys);
      }
      return json(res, 200, { ok: true, usedDevices: row.devices.length, revokedDevices: row.revokedDevices.length });
    }

    if (route === 'GET /license' || route === 'POST /license-info') {
      const body = req.method === 'POST' ? await readBody(req) : {};
      const { k, row } = findKey(body.key || url.searchParams.get('key'));
      if (!row) return json(res, 404, { ok: false, error: 'key_not_found' });
      return json(res, 200, {
        ok: true, key: row.key, plan: row.plan, label: (PLANS[row.plan] || {}).label,
        maxDevices: row.maxDevices, usedDevices: row.devices.length,
        status: row.status, createdAt: row.createdAt
      });
    }

    if (route === 'POST /webhooks/payment') {
      const raw = await new Promise((resolve, reject) => {
        let b = '';
        req.on('data', c => { b += c; if (b.length > 1e6) { reject(new Error('too large')); req.destroy(); } });
        req.on('end', () => resolve(b));
        req.on('error', reject);
      });
      if (WEBHOOK_SECRET) {
        const sig = req.headers['x-signature'] || '';
        const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
        const a = Buffer.from(String(sig), 'utf8');
        const b = Buffer.from(expected, 'utf8');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          return json(res, 401, { ok: false, error: 'bad_signature' });
        }
      }

      const event = JSON.parse(raw || '{}');
      const plan = PLANS[event.plan] ? event.plan : 'basic';
      const devices = Math.max(1, Number(event.devices) || 1);
      const order = {
        id: event.orderId || `ord_${crypto.randomBytes(6).toString('hex')}`,
        email: event.email || null, plan, devices,
        provider: event.provider || 'manual', amount: event.amount || null,
        createdAt: new Date().toISOString(), status: 'paid'
      };
      if (orders.some(o => o.id === order.id)) return json(res, 200, { ok: true, duplicate: true, order: { id: order.id } });
      order.key = issue(devices, plan, `order:${order.id}`)[0].key;
      orders.push(order);
      saveJSON(ORDERS_FILE, orders);
      return json(res, 200, { ok: true, order: { id: order.id, key: order.key, plan, devices } });
    }

    if (url.pathname.startsWith('/admin')) {
      if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'unauthorized' });

      if (route === 'GET /admin/keys') {
        return json(res, 200, {
          ok: true,
          keys: keys.map(k => ({ ...k, deviceCount: k.devices.length })),
          orders
        });
      }
      if (route === 'POST /admin/keys') {
        const body = await readBody(req);
        const rows = issue(Math.min(Number(body.count) || 1, 500), body.plan, body.note);
        return json(res, 201, { ok: true, keys: rows.map(r => r.key) });
      }
      if (route === 'POST /admin/revoke') {
        const body = await readBody(req);
        const { row } = findKey(body.key);
        if (!row) return json(res, 404, { ok: false, error: 'key_not_found' });
        row.status = 'revoked';
        saveJSON(KEYS_FILE, keys);
        return json(res, 200, { ok: true });
      }
      if (route === 'POST /admin/reactivate') {
        const body = await readBody(req);
        const { row } = findKey(body.key);
        if (!row) return json(res, 404, { ok: false, error: 'key_not_found' });
        if (row.status !== 'active') return json(res, 403, { ok: false, error: 'key_revoked' });
        if (row.devices.length >= row.maxDevices) {
          return json(res, 409, { ok: false, error: 'device_limit_reached', maxDevices: row.maxDevices });
        }
        row.revokedDevices = row.revokedDevices || [];
        const idx = row.revokedDevices.findIndex(d => d.id === body.deviceId);
        if (idx < 0) return json(res, 404, { ok: false, error: 'device_not_found' });
        const [dev] = row.revokedDevices.splice(idx, 1);
        delete dev.deactivatedAt;
        row.devices.push(dev);
        saveJSON(KEYS_FILE, keys);
        return json(res, 200, { ok: true, usedDevices: row.devices.length });
      }
      return json(res, 404, { ok: false, error: 'not_found' });
    }

    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (err) {
    return json(res, 400, { ok: false, error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mero license server -> http://localhost:${PORT}`);
  console.log(`admin token: ${ADMIN_TOKEN === 'change-me-admin-token' ? 'DEFAULT (غيّره!)' : 'set'}`);
});
