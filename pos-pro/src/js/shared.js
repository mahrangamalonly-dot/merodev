import { db } from './db.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const money = (n, cur = 'ج.م') =>
  `${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

export const num = n => Number(n || 0).toLocaleString('en-US');

export const dmy = ts => new Date(ts).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const dtLocal = ts => {
  const d = ts ? new Date(ts) : new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export const orderTotal = o => Number(o.total || 0);

export const monthKey = ts => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = key => {
  const [y, m] = key.split('-');
  const names = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return `${names[Number(m) - 1]} ${y}`;
};

export function monthRange(key) {
  const [y, m] = key.split('-').map(Number);
  return { from: new Date(y, m - 1, 1).getTime(), to: new Date(y, m, 0, 23, 59, 59, 999).getTime() };
}

export const creditBalance = custId => {
  const data = db.get();
  const charged = data.orders
    .filter(o => o.customerType === 'آجل' && o.customerId === custId && o.status !== 'ملغي')
    .reduce((s, o) => s + orderTotal(o), 0);
  const paid = data.settlements
    .filter(s => s.kind === 'credit' && s.customerId === custId)
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  return charged - paid;
};

export const creditStatement = custId => {
  const data = db.get();
  const orders = data.orders.filter(o => o.customerType === 'آجل' && o.customerId === custId && o.status !== 'ملغي');
  const pays = data.settlements.filter(s => s.kind === 'credit' && s.customerId === custId);
  const rows = [
    ...orders.map(o => ({ date: new Date(o.date).getTime(), label: `فاتورة #${o.no}`, amount: orderTotal(o), type: 'charge' })),
    ...pays.map(p => ({ date: new Date(p.date).getTime(), label: 'دفعة' + (p.notes ? ` — ${p.notes}` : ''), amount: -Number(p.amount || 0), type: 'pay' }))
  ].sort((a, b) => a.date - b.date);
  let running = 0;
  rows.forEach(r => { running += r.amount; r.balance = running; });
  return rows;
};

export const monthlyOrders = (custId, key) => {
  const data = db.get();
  const { from, to } = monthRange(key);
  return data.orders
    .filter(o => o.customerType === 'شهري' && o.customerId === custId && o.status !== 'ملغي'
      && new Date(o.date).getTime() >= from && new Date(o.date).getTime() <= to)
    .sort((a, b) => a.date - b.date);
};

export const monthlyTotals = key => {
  const data = db.get();
  const { from, to } = monthRange(key);
  const out = {};
  data.orders
    .filter(o => o.customerType === 'شهري' && o.status !== 'ملغي'
      && new Date(o.date).getTime() >= from && new Date(o.date).getTime() <= to)
    .forEach(o => { out[o.customerId] = (out[o.customerId] || 0) + orderTotal(o); });
  return out;
};

export const settledAmount = (custId, key) =>
  db.get().settlements
    .filter(s => s.kind === 'monthly' && s.customerId === custId && s.month === key)
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

export const monthsList = () => {
  const data = db.get();
  const keys = new Set();
  data.orders.filter(o => o.customerType === 'شهري').forEach(o => keys.add(monthKey(o.date)));
  data.settlements.filter(s => s.kind === 'monthly').forEach(s => keys.add(s.month));
  keys.add(monthKey(Date.now()));
  return [...keys].sort().reverse();
};

export const employeeStats = (empId, key) => {
  const data = db.get();
  const { from, to } = monthRange(key);
  const orders = data.orders.filter(o => o.employeeId === empId && o.status !== 'ملغي'
    && new Date(o.date).getTime() >= from && new Date(o.date).getTime() <= to);
  const delivered = orders.filter(o => o.status === 'تم التوصيل');
  const fees = orders.reduce((s, o) => s + Number(o.delivery || 0), 0);
  const advances = data.advances.filter(a => a.employeeId === empId).reduce((s, a) => s + Number(a.amount || 0), 0);
  const deductions = data.deductions.filter(d => d.employeeId === empId).reduce((s, d) => s + Number(d.amount || 0), 0);
  return { orders: orders.length, delivered: delivered.length, fees, advances, deductions, due: fees - advances - deductions };
};

export const driverName = id => {
  const e = db.get().employees.find(x => x.id === id);
  return e ? e.name : '—';
};

export const statusClass = s => (s === 'تم التوصيل' ? 'ok' : s === 'ملغي' ? 'off' : 'warn');

export const CS = { NORMAL: 'عادي', MONTHLY: 'شهري', CREDIT: 'آجل' };
export const STATUSES = ['جديد', 'تم التوصيل', 'ملغي'];
export const PAYMENTS = ['نقدي', 'إنستاباي', 'بطاقة', 'آجل', 'شهري'];
