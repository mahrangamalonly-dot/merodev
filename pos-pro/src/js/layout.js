import { db } from './db.js';
import { toast, esc, ICONS } from './utils.js';
import LoginView from './views/login.js';
import LicenseScreen from './views/license.js';

const routes = [
  { path: 'dashboard', label: 'لوحة اليوم', icon: ICONS.dash },
  { path: 'invoice', label: 'فاتورة جديدة', icon: ICONS.inv },
  { path: 'orders', label: 'الفواتير', icon: ICONS.list },
  { path: 'credit', label: 'العملاء الآجل', icon: ICONS.credit },
  { path: 'monthly', label: 'العملاء الشهريون', icon: ICONS.cal },
  { path: 'employees', label: 'الموظفين', icon: ICONS.users },
  { path: 'expenses', label: 'المصروفات', icon: ICONS.cash },
  { path: 'reports', label: 'التقارير', icon: ICONS.chart },
  { path: 'settings', label: 'الإعدادات', icon: ICONS.gear }
];

const modules = {
  dashboard: () => import('./views/dashboard.js'),
  invoice: () => import('./views/invoice.js'),
  orders: () => import('./views/orders.js'),
  credit: () => import('./views/credit.js'),
  monthly: () => import('./views/monthly.js'),
  employees: () => import('./views/employees.js'),
  expenses: () => import('./views/expenses.js'),
  reports: () => import('./views/reports.js'),
  settings: () => import('./views/settings.js')
};

let lockTimer = null;
let idleTimer = null;

export function boot(root) {
  if (!db.get()) db.set({});
  renderGate(root);
  startLockGuard(root);
  window.addEventListener('hashchange', () => route(root));
}

function renderGate(root) {
  const data = db.get();
  const licensed = data.activated && data.license && data.license.online && !data.license.trial;

  if (!licensed) {
    root.innerHTML = LicenseScreen.render();
    LicenseScreen.mount(root);
    return;
  }
  const user = session();
  if (!user) {
    root.innerHTML = LoginView.render();
    LoginView.mount(root, () => renderShell(root, session()));
    return;
  }
  renderShell(root, user);
}

function session() {
  try { const raw = sessionStorage.getItem('mero.pro.session.v1'); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}

function renderShell(root, user) {
  const data = db.get();
  root.innerHTML = `
    <div class="shell">
      <aside class="side" id="side">
        <div class="side-brand">
          <span class="brand-mark">
            <svg viewBox="0 0 64 64" width="32" height="32" aria-hidden="true">
              <defs><linearGradient id="lp" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#e879f9"/>
              </linearGradient></defs>
              <rect x="2" y="2" width="60" height="60" rx="16" fill="#12081f" stroke="url(#lp)" stroke-width="2"/>
              <path d="M18 18v10h28V18z" fill="url(#lp)"/>
              <path d="M18 32h14v14H18z" fill="url(#lp)" opacity=".75"/>
              <circle cx="45" cy="40" r="6.5" fill="#e879f9"/>
            </svg>
          </span>
          <div class="side-brand-txt">
            <strong>Mero <span>POS Pro</span></strong>
            <small>${esc(data.settings.businessName)}</small>
          </div>
        </div>
        <nav class="side-nav" id="sideNav">
          ${routes.map(r => `<a href="#/${r.path}" data-route="${r.path}">
            <span class="ni">${r.icon}</span><span>${r.label}</span></a>`).join('')}
        </nav>
        <div class="side-foot">
          <button class="btn btn-ghost btn-sm" id="btnLock">قفل الشاشة</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="topbar-title">
            <h2 id="viewTitle">لوحة اليوم</h2>
            <span class="muted" id="clock"></span>
          </div>
          <div class="topbar-actions">
            <a class="btn btn-primary" href="#/invoice">${ICONS.plus} فاتورة جديدة</a>
          </div>
        </header>
        <section class="view" id="view"></section>
      </div>
    </div>`;

  root.querySelector('#btnLock').addEventListener('click', () => lockNow(root));

  const tick = () => {
    const el = root.querySelector('#clock');
    if (el) el.textContent = new Date().toLocaleString('ar-EG', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 1000);
  startIdle(root);
  route(root);
}

function startIdle(root) {
  clearTimeout(idleTimer);
  const minutes = Number(db.get().settings.autoLockMinutes) || 5;
  const reset = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => lockNow(root), minutes * 60000);
  };
  ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(ev =>
    document.addEventListener(ev, reset, { passive: true }));
  reset();
}

function lockNow(root) {
  clearTimeout(idleTimer);
  sessionStorage.removeItem('mero.pro.session.v1');
  renderGate(root);
  toast('تم قفل الشاشة');
}

function startLockGuard() {
  clearInterval(lockTimer);
  lockTimer = setInterval(() => {
    const data = db.get();
    if (!data?.license?.online) return;
    fetch(`${data.settings.licenseServer.replace(/\/+$/, '')}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: data.license.key, deviceId: data.deviceId })
    })
      .then(r => r.json())
      .then(res => {
        if (res.ok) db.update(d => { if (d.license) d.license.verifiedAt = Date.now(); });
        else if (res.error && res.error !== 'network') {
          db.update(d => { d.activated = false; d.license = null; });
          toast('انتهت صلاحية الترخيص');
          setTimeout(() => location.reload(), 800);
        }
      })
      .catch(() => {});
  }, 6 * 60 * 60 * 1000);
}

function route(root) {
  if (typeof window.__cleanup === 'function') window.__cleanup();
  window.__cleanup = null;

  const path = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
  const target = routes.find(r => r.path === path) || routes[0];

  if (!root.querySelector('#sideNav')) { renderGate(root); return; }

  root.querySelectorAll('#sideNav a').forEach(a =>
    a.classList.toggle('active', a.dataset.route === target.path));
  root.querySelector('#viewTitle').textContent = target.label;

  modules[target.path]().then(mod => {
    const view = mod.default;
    const host = root.querySelector('#view');
    host.innerHTML = view.render();
    window.__cleanup = typeof view.mount === 'function' ? view.mount(host) : null;
  }).catch(err => {
    root.querySelector('#view').innerHTML = `<p class="empty">تعذّر تحميل العرض: ${esc(err.message)}</p>`;
  });
}
