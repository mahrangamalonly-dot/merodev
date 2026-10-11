import { LICENSE_SERVER } from './config.js';

const DB_KEY = 'mero.pro.db.v1';
const SESSION_KEY = 'mero.pro.session.v1';
const PIN_KEY = 'mero.pro.pin.v1';

export const emptyDB = () => ({
  activated: false,
  license: null,
  deviceId: 'dev_' + Math.random().toString(36).slice(2, 10),
  settings: {
    businessName: 'مكتب إنجاز للتوصيل',
    phone: '',
    whatsapp: '',
    address: '',
    logo: '',
    paper: '80mm',
    currency: 'ج.م',
    autoLockMinutes: 5,
    licenseServer: LICENSE_SERVER,
    autoBackup: true
  },
  orders: [],
  creditCustomers: [],
  monthlyCustomers: [],
  settlements: [],
  employees: [],
  attendance: [],
  advances: [],
  deductions: [],
  expenses: [],
  products: [],
  nextInvoice: 1001,
  undo: null
});

let cache = null;

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) { cache = null; return cache; }
    const parsed = JSON.parse(raw);
    cache = { ...emptyDB(), ...parsed };
    if (!parsed.deviceId) persist();
  } catch { cache = null; }
  return cache;
}

function persist() {
  if (!cache) return;
  try { localStorage.setItem(DB_KEY, JSON.stringify(cache)); } catch (e) { console.error('فشل الحفظ', e); }
}

export const db = {
  get() { return read(); },
  set(next) {
    const merged = { ...emptyDB(), ...next };
    if (!merged.deviceId) merged.deviceId = 'dev_' + Math.random().toString(36).slice(2, 10);
    cache = merged;
    persist();
  },
  update(mutator) {
    const next = structuredClone(read() || emptyDB());
    mutator(next);
    db.set(next);
  },
  reset() {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(PIN_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    cache = null;
  }
};

export const session = {
  get() {
    try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  },
  set(u) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(u)); },
  clear() { sessionStorage.removeItem(SESSION_KEY); }
};

export const pin = {
  get() { return localStorage.getItem(PIN_KEY) || ''; },
  set(hash) { localStorage.setItem(PIN_KEY, hash); },
  clear() { localStorage.removeItem(PIN_KEY); }
};

export async function hashPin(text) {
  const salt = 'mero_pro_2026';
  try {
    const data = new TextEncoder().encode(text + salt);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0;
    const s = text + salt;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return 'fb_' + Math.abs(h).toString(36);
  }
}

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function exportJSON() {
  return JSON.stringify(db.get(), null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.orders)) throw new Error('bad');
  db.set({ ...emptyDB(), ...parsed });
}
