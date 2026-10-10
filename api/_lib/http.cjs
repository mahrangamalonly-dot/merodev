const store = require('./store.cjs');

function applyCors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
  const origin = allowed.includes('*') ? '*' : (req.headers.origin || allowed[0] || '*');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function send(res, status, body) {
  res.status(status).json(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    const timer = setTimeout(() => reject(new Error('body_timeout')), 10000);
    const done = value => { clearTimeout(timer); resolve(value); };
    req.on('data', c => {
      raw += c;
      if (raw.length > 1e6) { clearTimeout(timer); reject(new Error('payload too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { done(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('invalid json')); }
    });
    req.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

function isAdmin(req) {
  const token = process.env.ADMIN_TOKEN || '';
  if (!token) return false;
  const auth = req.headers.authorization || '';
  const value = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-admin-token'];
  return Boolean(value) && value === token;
}

function withState(handler) {
  return async (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    const bodyPromise = (req.method === 'GET' || req.method === 'HEAD')
      ? Promise.resolve({})
      : readBody(req);

    try {
      const state = await store.load();
      const body = await bodyPromise.catch(() => ({}));
      const result = handler(state, body, req);
      if (result.mutated) await store.save(state);
      send(res, result.status, result.body);
    } catch (err) {
      send(res, 400, { ok: false, error: err.message });
    }
  };
}

module.exports = { applyCors, send, readBody, isAdmin, withState };
