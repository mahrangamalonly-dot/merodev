import { session, db } from './store.js';
import { esc, toast, ICONS, money, timeAgo, setRange } from './store.js';
import LoginView from './views/login.js';

const routes = [
  { path: 'overview', label: 'نظرة عامة', icon: ICONS.dash },
  { path: 'sales', label: 'المبيعات', icon: ICONS.chart },
  { path: 'products', label: 'المنتجات', icon: ICONS.box },
  { path: 'stock', label: 'المخزون', icon: ICONS.alert },
  { path: 'invoices', label: 'الفواتير', icon: ICONS.receipt }
];

const modules = {
  overview: () => import('./views/overview.js'),
  sales: () => import('./views/sales.js'),
  products: () => import('./views/products.js'),
  stock: () => import('./views/stock.js'),
  invoices: () => import('./views/invoices.js')
};

let cleanup = null;
let interval = null;

export function boot(root) {
  const user = session.get();
  const data = db.get();

  if (!data?.activated || !data.license?.online) {
    renderGate(root, 'لوحة المعلومات تحتاج ترخيصًا مفعّلًا على هذا الجهاز.');
    return;
  }
  if (!user || !data.users.some(u => u.id === user.id && u.active)) {
    renderGate(root);
    return;
  }
  renderShell(root, user);
}

function renderGate(root, message = '') {
  root.innerHTML = `
    <div class="gate">
      <div class="gate-card">
        <span class="brand-mark" style="display:inline-grid;place-items:center;filter:drop-shadow(0 0 14px rgba(168,85,247,.7))">
          <svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true">
            <defs><linearGradient id="d1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#e879f9"/>
            </linearGradient></defs>
            <rect x="2" y="2" width="60" height="60" rx="16" fill="#12081f" stroke="url(#d1)" stroke-width="2"/>
            <path d="M18 18v10h28V18z" fill="url(#d1)"/>
            <path d="M18 32h14v14H18z" fill="url(#d1)" opacity=".75"/>
            <circle cx="45" cy="40" r="6.5" fill="#e879f9"/>
          </svg>
        </span>
        <h1>Mero <span class="grad">Dashboard</span></h1>
        <p>لوحة معلومات المبيعات</p>
        ${message ? `<p style="color:var(--warn);margin-top:.8rem">${esc(message)}</p>` : ''}
        <div id="gateSlot"></div>
      </div>
    </div>`;

  const slot = root.querySelector('#gateSlot');
  if (!message) {
    slot.innerHTML = LoginView.render();
    LoginView.mount(slot, () => renderShell(root, session.get()));
  }
}

function renderShell(root, user) {
  const data = db.get();
  document.title = `${data.settings.storeName} — لوحة المعلومات`;

  root.innerHTML = `
    <div class="shell">
      <aside class="side" id="side">
        <div class="side-brand">
          <span class="brand-mark">
            <svg viewBox="0 0 64 64" width="32" height="32" aria-hidden="true">
              <defs><linearGradient id="d2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#e879f9"/>
              </linearGradient></defs>
              <rect x="2" y="2" width="60" height="60" rx="16" fill="#12081f" stroke="url(#d2)" stroke-width="2"/>
              <path d="M18 18v10h28V18z" fill="url(#d2)"/>
              <path d="M18 32h14v14H18z" fill="url(#d2)" opacity=".75"/>
              <circle cx="45" cy="40" r="6.5" fill="#e879f9"/>
            </svg>
          </span>
          <div class="side-brand-txt">
            <strong>Mero <span>Dashboard</span></strong>
            <small>${esc(data.settings.storeName)}</small>
          </div>
        </div>
        <nav class="side-nav" id="sideNav">
          ${routes.map(r => `<a href="#/${r.path}" data-route="${r.path}">
            <span class="ni">${r.icon}</span><span>${r.label}</span></a>`).join('')}
        </nav>
        <div class="side-foot">
          <span class="lic-chip">${ICONS.key} ${data.license?.plan === 'trial' ? 'نسخة تجريبية' : 'ترخيص مفعّل'}</span>
          <button class="btn btn-ghost btn-sm" id="btnOut">خروج</button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="topbar-title">
            <h2 id="viewTitle">نظرة عامة</h2>
            <span class="muted" id="viewSub"></span>
          </div>
          <div class="topbar-actions">
            <div class="range-tabs" id="rangeTabs">
              <button class="rtab active" data-r="today">اليوم</button>
              <button class="rtab" data-r="week">7 أيام</button>
              <button class="rtab" data-r="month">30 يومًا</button>
              <button class="rtab" data-r="all">الكل</button>
            </div>
            <button class="btn btn-outline btn-sm" id="btnRefresh">تحديث</button>
          </div>
        </header>
        <section class="view" id="view"></section>
      </div>
    </div>`;

  root.querySelector('#btnOut').addEventListener('click', () => {
    session.clear();
    renderGate(root);
  });

  root.querySelector('#rangeTabs').addEventListener('click', e => {
    const b = e.target.closest('.rtab');
    if (!b) return;
    setRange(b.dataset.r);
    root.querySelectorAll('.rtab').forEach(x => x.classList.toggle('active', x === b));
    route(root);
  });

  root.querySelector('#btnRefresh').addEventListener('click', () => route(root));

  window.addEventListener('hashchange', () => route(root));

  route(root);
  if (interval) clearInterval(interval);
  interval = setInterval(() => route(root), 30000);
}

function route(root) {
  if (typeof cleanup === 'function') { cleanup(); cleanup = null; }
  const path = (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0];
  const target = routes.find(r => r.path === path) || routes[0];

  root.querySelectorAll('#sideNav a').forEach(a =>
    a.classList.toggle('active', a.dataset.route === target.path));
  root.querySelector('#viewTitle').textContent = target.label;
  root.querySelector('#viewSub').textContent = '';

  modules[target.path]().then(mod => {
    const view = mod.default;
    const host = root.querySelector('#view');
    host.innerHTML = view.render();
    cleanup = typeof view.mount === 'function' ? view.mount(host) : null;
  });
}

export { esc, toast, money, timeAgo };

boot(document.getElementById('app'));
