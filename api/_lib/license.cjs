const crypto = require('crypto');

const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RE = /^MERO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const PLANS = {
  basic: { devices: 1, label: 'أساسي', price: 1500 },
  pro: { devices: 1, label: 'احترافي', price: 3500 },
  enterprise: { devices: 10, label: 'مؤسسات', price: 6000 }
};

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

const validateFormat = key => RE.test(String(key || '').trim().toUpperCase());
const normalize = key => String(key || '').trim().toUpperCase();

function findKey(state, key) {
  const k = normalize(key);
  return { k, row: state.keys.find(x => x.key === k) };
}

function issue(state, count, plan, note) {
  const made = [];
  for (let i = 0; i < count; i++) {
    const row = {
      key: generateKey(),
      plan: PLANS[plan] ? plan : 'basic',
      maxDevices: (PLANS[plan] || PLANS.basic).devices,
      devices: [],
      revokedDevices: [],
      note: note || '',
      status: 'active',
      createdAt: new Date().toISOString()
    };
    state.keys.push(row);
    made.push(row);
  }
  return made;
}

function activate(state, body) {
  const { k, row } = findKey(state, body.key);
  if (!validateFormat(k) || !row) return { status: 404, body: { ok: false, error: 'key_not_found' } };
  if (row.status !== 'active') return { status: 403, body: { ok: false, error: 'key_revoked' } };
  if (!body.deviceId) return { status: 400, body: { ok: false, error: 'device_required' } };

  const existing = row.devices.find(d => d.id === body.deviceId);
  if (existing) {
    existing.lastSeen = new Date().toISOString();
  } else {
    if (row.devices.length >= row.maxDevices) {
      return { status: 409, body: { ok: false, error: 'device_limit_reached', maxDevices: row.maxDevices } };
    }
    if ((row.revokedDevices || []).some(d => d.id === body.deviceId)) {
      return { status: 403, body: { ok: false, error: 'device_deactivated' } };
    }
    row.devices.push({
      id: body.deviceId,
      name: body.deviceName ? String(body.deviceName).slice(0, 120) : null,
      activatedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    });
  }

  return {
    status: 200,
    body: {
      ok: true, plan: row.plan, maxDevices: row.maxDevices,
      usedDevices: row.devices.length, expiresAt: row.expiresAt || null
    }
  };
}

function verify(state, body) {
  const { k, row } = findKey(state, body.key);
  if (!validateFormat(k) || !row) return { status: 404, body: { ok: false, error: 'key_not_found' } };
  if (row.status !== 'active') return { status: 403, body: { ok: false, error: 'key_revoked' } };
  if (!row.devices.some(d => d.id === body.deviceId)) {
    return { status: 403, body: { ok: false, error: 'device_not_activated' } };
  }
  return { status: 200, body: { ok: true, plan: row.plan, expiresAt: row.expiresAt || null } };
}

function deactivate(state, body) {
  const { k, row } = findKey(state, body.key);
  if (!validateFormat(k) || !row) return { status: 404, body: { ok: false, error: 'key_not_found' } };
  row.revokedDevices = row.revokedDevices || [];
  const idx = row.devices.findIndex(d => d.id === body.deviceId);
  if (idx >= 0) {
    const [dev] = row.devices.splice(idx, 1);
    if (!row.revokedDevices.some(d => d.id === dev.id)) {
      row.revokedDevices.push({ ...dev, deactivatedAt: new Date().toISOString() });
    }
  }
  return { status: 200, body: { ok: true, usedDevices: row.devices.length, revokedDevices: row.revokedDevices.length } };
}

function revoke(state, body) {
  const { row } = findKey(state, body.key);
  if (!row) return { status: 404, body: { ok: false, error: 'key_not_found' } };
  row.status = 'revoked';
  return { status: 200, body: { ok: true } };
}

function reactivate(state, body) {
  const { row } = findKey(state, body.key);
  if (!row) return { status: 404, body: { ok: false, error: 'key_not_found' } };
  if (row.status !== 'active') return { status: 403, body: { ok: false, error: 'key_revoked' } };
  if (row.devices.length >= row.maxDevices) {
    return { status: 409, body: { ok: false, error: 'device_limit_reached', maxDevices: row.maxDevices } };
  }
  row.revokedDevices = row.revokedDevices || [];
  const idx = row.revokedDevices.findIndex(d => d.id === body.deviceId);
  if (idx < 0) return { status: 404, body: { ok: false, error: 'device_not_found' } };
  const [dev] = row.revokedDevices.splice(idx, 1);
  delete dev.deactivatedAt;
  row.devices.push(dev);
  return { status: 200, body: { ok: true, usedDevices: row.devices.length } };
}

function list(state) {
  return {
    keys: state.keys.map(k => ({ ...k, deviceCount: k.devices.length })),
    orders: state.orders || []
  };
}

function payment(state, body) {
  const plan = PLANS[body.plan] ? body.plan : 'basic';
  const devices = Math.max(1, Number(body.devices) || 1);
  const order = {
    id: body.orderId || `ord_${crypto.randomBytes(6).toString('hex')}`,
    email: body.email || null,
    plan,
    devices,
    provider: body.provider || 'manual',
    amount: body.amount || null,
    createdAt: new Date().toISOString(),
    status: 'paid'
  };
  state.orders = state.orders || [];
  if (state.orders.some(o => o.id === order.id)) {
    return { status: 200, body: { ok: true, duplicate: true, order: { id: order.id } } };
  }
  order.key = issue(state, 1, plan, `order:${order.id}`)[0].key;
  state.orders.push(order);
  return { status: 200, body: { ok: true, order: { id: order.id, key: order.key, plan, devices } } };
}

module.exports = {
  PLANS, generateKey, validateFormat, normalize,
  issue, activate, verify, deactivate, revoke, reactivate, list, payment
};
