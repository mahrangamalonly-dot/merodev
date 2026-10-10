export const money = (n, cur = 'ر.س') =>
  `${Number(n || 0).toFixed(2)} <small>${cur}</small>`;

export const plain = n => Number(n || 0).toFixed(2);

export const today = () => new Date().toISOString().slice(0, 10);

export const dateTime = ts => {
  const d = new Date(ts);
  return d.toLocaleString('ar-EG', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};

export const timeOnly = ts =>
  new Date(ts).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

export const esc = str =>
  String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ICONS = {
  pos: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7h18v12H3z" stroke="currentColor" stroke-width="1.7"/><path d="M8 7V5h8v2M8 12h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none"><path d="M21 8l-9-5-9 5 9 5 9-5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3 8v8l9 5 9-5V8" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 12l-8 8-9-9V4h7l10 8z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="7.5" cy="7.5" r="1.6" fill="currentColor"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-7M22 20V8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.5" stroke="currentColor" stroke-width="1.7"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M16 5.5a3.5 3.5 0 0 1 0 7M18 20c0-2.4-.8-4.2-2-5.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 20.4 10h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z" stroke="currentColor" stroke-width="1.5"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="15" r="4.5" stroke="currentColor" stroke-width="1.7"/><path d="M11.5 11.5L20 3M17 6l3 3M14 9l2.5 2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><rect x="7" y="14" width="10" height="6" rx="1" stroke="currentColor" stroke-width="1.7"/></svg>',
  power: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M7.5 6.3a7 7 0 1 0 9 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>'
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
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

let modalSeq = 0;

export function modal({ title = '', body = '', footer = '', size = '' }) {
  const id = `mdl_${++modalSeq}`;
  const host = document.createElement('div');
  host.className = 'modal-backdrop';
  host.id = id;
  host.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <h3>${esc(title)}</h3>
        <button class="modal-x" data-close aria-label="إغلاق">×</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  document.body.appendChild(host);
  requestAnimationFrame(() => host.classList.add('open'));

  const close = () => {
    host.classList.remove('open');
    setTimeout(() => host.remove(), 220);
  };
  host.addEventListener('click', e => {
    if (e.target === host || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  });

  return { root: host, close, id };
}

export function confirmDialog(text, { okText = 'تأكيد', danger = false } = {}) {
  return new Promise(resolve => {
    const m = modal({
      title: 'تأكيد العملية',
      body: `<p class="confirm-text">${esc(text)}</p>`,
      footer: `
        <button class="btn btn-outline" data-close>إلغاء</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>`
    });
    m.root.querySelector('[data-ok]').addEventListener('click', () => {
      m.close();
      resolve(true);
    });
    m.root.addEventListener('click', e => {
      if (e.target.closest('[data-close]') || e.target === m.root) resolve(false);
    });
  });
}

export function printHTML(html) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:auto auto 0 0;width:0;height:0;border:0;opacity:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
    <style>
      *{box-sizing:border-box}
      body{font-family:Cairo,sans-serif;margin:0;padding:10px;color:#000;background:#fff;width:80mm}
      h2{font-size:15px;margin:0 0 2px;text-align:center}
      .c{text-align:center;font-size:11px;line-height:1.6}
      .sep{border-top:1px dashed #000;margin:6px 0}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{padding:2px 0;text-align:start}
      th:nth-child(2),td:nth-child(2){text-align:center}
      th:last-child,td:last-child{text-align:end}
      .tot{display:flex;justify-content:space-between;font-size:13px;padding:2px 0}
      .big{font-size:16px;font-weight:800}
      .foot{text-align:center;margin-top:8px;font-size:11px}
      svg{display:block;margin:6px auto 0}
    </style></head><body>${html}</body></html>`);
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1200);
}
