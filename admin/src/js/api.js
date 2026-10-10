import { store } from './utils.js';

let server = 'http://127.0.0.1:8787';
let token = '';

export const api = {
  init() {
    const s = store.get();
    if (s) {
      server = s.server || server;
      token = s.token || '';
    }
    return s;
  },
  get credentials() { return { server, token }; },

  save(next) {
    server = next.server;
    token = next.token;
    store.set(next);
  },
  logout() { store.clear(); },

  async call(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${server.replace(/\/+$/, '')}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    }).catch(() => null);
    if (!res) throw new Error('network');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw Object.assign(new Error(data.error || `http_${res.status}`), { status: res.status });
    }
    return data;
  },

  keys() { return this.call('/admin/keys'); },
  createKeys(count, plan, note) {
    return this.call('/admin/keys', { method: 'POST', body: { count, plan, note } });
  },
  revoke(key) { return this.call('/admin/revoke', { method: 'POST', body: { key } }); },
  delete(key) { return this.call('/admin/delete', { method: 'POST', body: { key } }); },
  reactivate(key, deviceId) {
    return this.call('/admin/reactivate', { method: 'POST', body: { key, deviceId } });
  },
  deactivate(key, deviceId) {
    return this.call('/deactivate', { method: 'POST', body: { key, deviceId } });
  },
  ping() { return this.call('/health', { auth: false }); }
};

export const PLANS = {
  basic: { label: 'أساسي', devices: 1, price: 1500 },
  pro: { label: 'احترافي', devices: 1, price: 3500 },
  enterprise: { label: 'مؤسسات', devices: 10, price: 6000 }
};

export const planLabel = k => (PLANS[k] || { label: k }).label;
