import { db, session, uid } from './db.js';
import { seed } from './seed.js';
import { ICONS, esc, toast } from './utils.js';
import { LICENSE_SERVER, RECHECK_MS } from './config.js';
import LicenseScreen from './views/license.js';
import LoginView from './views/login.js';
import { callServer as callLicense, verifyOnline } from './views/license.js';

const routes = [
  { path: 'pos', label: 'الكاشير', icon: ICONS.pos, roles: ['admin', 'manager', 'cashier'] },
  { path: 'products', label: 'المنتجات', icon: ICONS.box, roles: ['admin', 'manager'] },
  { path: 'categories', label: 'التصنيفات', icon: ICONS.tag, roles: ['admin', 'manager'] },
  { path: 'reports', label: 'التقارير', icon: ICONS.chart, roles: ['admin', 'manager'] },
  { path: 'users', label: 'المستخدمون', icon: ICONS.users, roles: ['admin'] },
  { path: 'settings', label: 'الإعدادات', icon: ICONS.gear, roles: ['admin'] }
];

const modules = {
  pos: () => import('./views/pos.js'),
  products: () => import('./views/products.js'),
  categories: () => import('./views/categories.js'),
  reports: () => import('./views/reports.js'),
  users: () => import('./views/users.js'),
  settings: () => import('./views/settings.js')
};

const roleLabel = { admin: 'مدير النظام', manager: 'مشرف', cashier: 'كاشير' };

export function boot(root) {
  if (!db.get()) db.set({ ...buildInitial(), ...seed() });
  renderGate(root);
  startLicenseGuard();
  window.addEventListener('hashchange', () => renderRoute(root));
}

function buildInitial() {
  return {
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
    counter: 1000,
    held: []
  };
}

function renderGate(root) {
  const data = db.get();
  const user = session.get();
  const licensed = data.activated && data.license && data.license.online && !data.license.trial;

  if (!licensed) {
    root.innerHTML = LicenseScreen.render();
    LicenseScreen.mount(root);
    return;
  }
  if (!user || !data.users.some(u => u.id === user.id && u.active)) {
    root.innerHTML = LoginView.render();
    LoginView.mount(root);
    return;
  }
  renderShell(root, user);
}

async function startLicenseGuard() {
  const check = async () => {
    const data = db.get();
    if (!data?.license?.online || data.license.trial) return;
    const result = await verifyOnline(data.settings.licenseServer, data.license.key, data.deviceId);
    if (result.ok) {
      db.update(d => { if (d.license) d.license.verifiedAt = Date.now(); });
      return;
    }
    if (result.error === 'network') return;
    db.update(d => { d.activated = false; d.license = null; });
    toast('تم إلغاء صلاحية هذا الترخيص. يرجى إعادة التفعيل.', 'err');
    setTimeout(() => location.reload(), 900);
  };

  check();
  setInterval(check, RECHECK_MS);
}

function renderShell(root, user) {
  const data = db.get();
  const allowed = routes.filter(r => r.roles.includes(user.role));

  root.innerHTML = `
    <div class="shell">
      <aside class="side">
        <div class="side-brand">
          <span class="brand-mark">
            <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
              <defs><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#e879f9"/>
              </linearGradient></defs>
              <rect x="2" y="2" width="60" height="60" rx="16" fill="#12081f" stroke="url(#lg2)" stroke-width="2"/>
              <path d="M18 18v10h28V18z" fill="url(#lg2)"/>
              <path d="M18 32h14v14H18z" fill="url(#lg2)" opacity=".75"/>
              <circle cx="45" cy="40" r="6.5" fill="#e879f9"/>
            </svg>
          </span>
          <div class="side-brand-txt">
            <strong>Mero Dev <span>POS</span></strong>
            <small>${esc(data.settings.storeName)}</small>
          </div>
        </div>
        <nav class="side-nav" id="sideNav">
          ${allowed.map(r => `
            <a href="#/${r.path}" data-route="${r.path}">
              <span class="ni">${r.icon}</span>
              <span>${r.label}</span>
            </a>`).join('')}
        </nav>
        <div class="side-foot">
          <span class="lic-chip" title="${esc(data.license?.key || '')}">
            ${ICONS.key} مرخّص
          </span>
          <button class="btn btn-ghost btn-sm" id="btnLogout">${ICONS.power} خروج</button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="topbar-title">
            <h2 id="viewTitle">الكاشير</h2>
            <span id="viewSub" class="muted"></span>
          </div>
          <div class="topbar-actions">
            <span class="clock" id="clock"></span>
            <div class="user-chip">
              <span class="avatar">${esc(user.name.slice(0, 1))}</span>
              <span class="user-meta">
                <strong>${esc(user.name)}</strong>
                <small>${roleLabel[user.role] || user.role}</small>
              </span>
            </div>
          </div>
        </header>
        <section class="view" id="view"></section>
      </div>
    </div>`;

  root.querySelector('#btnLogout').addEventListener('click', () => {
    session.clear();
    location.hash = '';
    renderGate(root);
  });

  const tick = () => {
    const el = root.querySelector('#clock');
    if (el) el.textContent = new Date().toLocaleString('ar-EG', {
      weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };
  tick();
  setInterval(tick, 1000);

  renderRoute(root);
}

function renderRoute(root) {
  const data = db.get();
  const user = session.get();
  if (!data.activated || !user) { renderGate(root); return; }
  if (!root.querySelector('#sideNav')) { renderShell(root, user); return; }
  teardown();

  const path = (location.hash.replace(/^#\/?/, '') || 'pos').split('?')[0];
  const route = routes.find(r => r.path === path);
  const target = route && route.roles.includes(user.role) ? route : routes[0];

  root.querySelectorAll('#sideNav a').forEach(a =>
    a.classList.toggle('active', a.dataset.route === target.path));
  root.querySelector('#viewTitle').textContent = target.label;
  root.querySelector('#viewSub').textContent = '';

  modules[target.path]().then(mod => {
    const view = mod.default;
    const old = root.querySelector('#view');
    const host = old.cloneNode(false);
    old.replaceWith(host);
    host.innerHTML = view.render();
    currentCleanup = typeof view.mount === 'function' ? view.mount(host) : null;
  });
}

let currentCleanup = null;

function teardown() {
  if (typeof currentCleanup === 'function') currentCleanup();
  currentCleanup = null;
}
