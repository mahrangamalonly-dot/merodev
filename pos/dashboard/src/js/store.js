const DB_KEY = 'mero.pos.db.v1';
const SESSION_KEY = 'mero.pos.session.v1';

export const session = {
  get() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(u) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(u)); },
  clear() { sessionStorage.removeItem(SESSION_KEY); }
};

export const db = {
  get() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
};

export const esc = str => String(str ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const money = (n, cur = 'ج.م') =>
  `${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

export const timeAgo = ts => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `قبل ${s} ثانية`;
  if (s < 3600) return `قبل ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)} ساعة`;
  return `قبل ${Math.floor(s / 86400)} يوم`;
};

export function toast(msg, type = 'info') {
  let wrap = document.querySelector('.toasts');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toasts';
    wrap.style.cssText = 'position:fixed;bottom:1.4rem;inset-inline-start:1.4rem;z-index:200;display:flex;flex-direction:column;gap:.5rem';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  el.style.cssText = 'padding:.75rem 1.1rem;border-radius:12px;font-size:.88rem;font-weight:600;background:rgba(18,8,31,.95);border:1px solid var(--line-strong);color:var(--text);transform:translateY(14px);opacity:0;transition:.25s';
  wrap.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = 'none'; el.style.opacity = '1'; });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

export function rangeBounds(range) {
  const now = new Date();
  const start = new Date(now);
  if (range === 'today') start.setHours(0, 0, 0, 0);
  else if (range === 'week') start.setDate(start.getDate() - 6);
  else if (range === 'month') start.setDate(start.getDate() - 29);
  else start.setFullYear(2000);
  return { from: start.getTime(), to: Date.now() };
}

let currentRange = 'today';

export function setRange(range) {
  currentRange = range;
}

export function getRange() {
  return currentRange;
}

export function filteredSales(range) {
  const data = db.get();
  if (!data) return [];
  const { from, to } = rangeBounds(range || currentRange);
  return data.sales.filter(s => s.ts >= from && s.ts <= to).sort((a, b) => b.ts - a.ts);
}

export const ICONS = {
  dash: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z" stroke="currentColor" stroke-width="1.7"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-7M22 20V8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none"><path d="M21 8l-9-5-9 5 9 5 9-5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3 8v8l9 5 9-5V8" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l9 16H3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18l-2-1.5L15 21l-2-1.5L11 21l-2-1.5L7 21l-2-1.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8h6M9 12h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="15" r="4.5" stroke="currentColor" stroke-width="1.7"/><path d="M11.5 11.5L20 3M17 6l3 3M14 9l2.5 2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
};

export function buildBars(entries, { format = v => v } = {}) {
  if (!entries.length) return '<div class="chart-empty">لا توجد بيانات في هذه الفترة</div>';
  const max = Math.max(...entries.map(e => e.value), 1);
  return `<div class="chart">${entries.map(e => `
    <div class="bar-col" title="${esc(e.label)}: ${esc(format(e.value))}">
      <span class="bar" style="height:${Math.max((e.value / max) * 100, 2)}%"></span>
      <small>${esc(e.short || e.label)}</small>
    </div>`).join('')}</div>`;
}
