import { LICENSE_SERVER } from './config.js';

const DB_KEY = 'mero.pos.db.v1';
const SESSION_KEY = 'mero.pos.session.v1';

const listeners = new Set();

export const emptyDB = () => ({
  activated: false,
  license: null,
  deviceId: uid('dev'),
  settings: {
    storeName: 'متجر ميرو',
    phone: '',
    address: '',
    currency: 'ر.س',
    taxRate: 15,
    receiptFooter: 'شكرًا لزيارتكم — Mero Dev POS',
    lowStock: 5,
    printerWidth: 80,
    licenseServer: LICENSE_SERVER
  },
  users: [],
  categories: [],
  products: [],
  sales: [],
  held: [],
  counter: 1000
});

let cache = null;

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      cache = null;
      return cache;
    }
    const parsed = JSON.parse(raw);
    const migrated = !parsed.deviceId;
    if (migrated) parsed.deviceId = uid('dev');
    cache = { ...emptyDB(), ...parsed };
    if (migrated) persist();
  } catch {
    cache = null;
  }
  return cache;
}

function persist() {
  if (!cache) return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error('فشل حفظ البيانات', err);
  }
  listeners.forEach(fn => fn(cache));
}

export const db = {
  get() {
    const data = read();
    if (!data) return null;
    return data;
  },
  set(next) {
    if (!next.deviceId) next.deviceId = uid('dev');
    cache = next;
    persist();
  },
  update(mutator) {
    const next = structuredClone(read() || emptyDB());
    mutator(next);
    db.set(next);
  },
  reset() {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
    cache = null;
    listeners.forEach(fn => fn(null));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  onChange(fn) {
    return db.subscribe(fn);
  }
};

export const session = {
  get() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  },
  clear() {
    sessionStorage.removeItem(SESSION_KEY);
  }
};

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
