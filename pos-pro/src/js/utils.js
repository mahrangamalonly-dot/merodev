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

export const toLocalInput = ts => dtLocal(ts);

export const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
export const thisWeek = ts => {
  const d = new Date(ts); const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0);
  return d >= start && d <= now;
};
export const thisMonth = ts => {
  const d = new Date(ts); const n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
};

export function toast(msg, type = 'info') {
  let wrap = document.querySelector('.toasts');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toasts';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 2800);
}

let seq = 0;
export function modal({ title = '', body = '', footer = '', size = '' }) {
  const host = document.createElement('div');
  host.className = 'modal-backdrop';
  host.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(title)}</h3>
        <button class="modal-x" data-close aria-label="إغلاق">×</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  document.body.appendChild(host);
  requestAnimationFrame(() => host.classList.add('open'));
  const close = () => { host.classList.remove('open'); setTimeout(() => host.remove(), 200); };
  host.addEventListener('click', e => { if (e.target === host || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
  return { root: host, close };
}

export function confirmDialog(text, { okText = 'تأكيد', danger = false } = {}) {
  return new Promise(resolve => {
    const m = modal({
      title: 'تأكيد العملية',
      body: `<p class="confirm-text">${esc(text)}</p>`,
      footer: `<button class="btn btn-outline" data-close>إلغاء</button>
               <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>`
    });
    m.root.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(true); });
    m.root.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === m.root) resolve(false); });
  });
}

export function printHTML(html, paper = '80mm') {
  const width = paper === 'A4' ? '210mm' : (paper === '72mm' ? '72mm' : '80mm');
  const font = paper === 'A4' ? '12px' : (paper === '72mm' ? '11px' : '12px');
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:auto auto 0 0;width:0;height:0;border:0;opacity:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Cairo,sans-serif;font-size:${font};color:#000;background:#fff;width:${width};padding:8px;line-height:1.5}
      .brand{text-align:center;font-weight:900;font-size:1.25em}
      .sub{text-align:center;font-size:.9em;margin-bottom:4px}
      .div{border-top:1px dashed #000;margin:6px 0}
      .meta{display:flex;justify-content:space-between;font-size:.95em;padding:1px 0}
      table{width:100%;border-collapse:collapse;font-size:.95em}
      th,td{padding:2px 0;text-align:start;border-bottom:1px dotted #ccc}
      th:nth-child(2),td:nth-child(2),th:nth-child(3),td:nth-child(3){text-align:center}
      th:last-child,td:last-child{text-align:end}
      .info{display:flex;justify-content:space-between;font-size:.95em;padding:1px 0}
      .addr{font-size:.9em;margin:3px 0;word-break:break-word}
      .tot{display:flex;justify-content:space-between;font-weight:700;padding:2px 0}
      .grand{font-size:1.3em;border-top:2px solid #000;margin-top:4px;padding-top:4px}
      .thanks{text-align:center;margin-top:8px;font-size:.9em}
      .stat{display:flex;justify-content:space-between;padding:2px 0;font-size:.95em}
      .center{text-align:center}
      h3{font-size:1.1em;text-align:center;margin:4px 0}
      @media print { @page { size: ${width} auto; margin: 0 } }
    </style></head><body>${html}</body></html>`);
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1500);
}

export const ICONS = {
  dash: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z" stroke="currentColor" stroke-width="1.7"/></svg>',
  inv: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18l-2-1.5L15 21l-2-1.5L11 21l-2-1.5L7 21l-2-1.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8h6M9 12h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  credit: '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="13" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M2 10h20M6 15h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none"><path d="M21 8l-9-5-9 5 9 5 9-5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3 8v8l9 5 9-5V8" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.5" stroke="currentColor" stroke-width="1.7"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M16 5.5a3.5 3.5 0 0 1 0 7M18 20c0-2.4-.8-4.2-2-5.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  cash: '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M6 12h.01M18 12h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-7M22 20V8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><rect x="7" y="14" width="10" height="6" rx="1" stroke="currentColor" stroke-width="1.7"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.2 1.2-1.9 1.2-.6 0-1.9-.3-3.6-1.6-1.9-1.4-3.1-3.4-3.2-3.6-.2-.4-.5-1.2-.5-1.9 0-.8.4-1.3.7-1.6.2-.2.4-.3.7-.3h.5c.2 0 .4.1.6.5l.7 1.6c.1.2.1.4 0 .6l-.3.5-.3.3c-.1.1-.2.3 0 .6.3.5.8 1.2 1.4 1.7.8.7 1.4 1 1.7 1.1.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.5.8c.3.2.4.3.4.5s0 .8-.1 1.3z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="15" r="4.5" stroke="currentColor" stroke-width="1.7"/><path d="M11.5 11.5L20 3M17 6l3 3M14 9l2.5 2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
};
