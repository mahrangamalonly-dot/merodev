import { api } from './api.js';
import { ICONS, esc } from './utils.js';
import LoginView from './views/login.js';

const routes = [
  { path: 'dashboard', label: 'نظرة عامة', icon: ICONS.dash },
  { path: 'requests', label: 'طلبات التجربة', icon: ICONS.inbox },
  { path: 'keys', label: 'المفاتيح', icon: ICONS.key },
  { path: 'orders', label: 'الطلبات', icon: ICONS.cart },
  { path: 'settings', label: 'الإعدادات', icon: ICONS.gear }
];

const modules = {
  dashboard: () => import('./views/dashboard.js'),
  requests: () => import('./views/requests.js'),
  keys: () => import('./views/keys.js'),
  orders: () => import('./views/orders.js'),
  settings: () => import('./views/settings.js')
};

let currentCleanup = null;

export function boot(root) {
  const saved = api.init();
  renderGate(root, saved);
  window.addEventListener('hashchange', () => route(root));
}

function renderGate(root, saved) {
  if (!saved) {
    root.innerHTML = LoginView.render();
    LoginView.mount(root);
    return;
  }
  api.ping()
    .then(() => renderShell(root))
    .catch(() => {
      api.logout();
      root.innerHTML = LoginView.render({ error: 'تعذّر الاتصال بالسيرفر أو الرمز غير صالح.' });
      LoginView.mount(root);
    });
}

function renderShell(root) {
  root.innerHTML = `
    <div class="shell">
      <aside class="side">
        <div class="side-brand">
          <span class="brand-mark">
            <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
              <defs><linearGradient id="lga" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#e879f9"/>
              </linearGradient></defs>
              <rect x="2" y="2" width="60" height="60" rx="16" fill="#12081f" stroke="url(#lga)" stroke-width="2"/>
              <path d="M18 18v10h28V18z" fill="url(#lga)"/>
              <path d="M18 32h14v14H18z" fill="url(#lga)" opacity=".75"/>
              <circle cx="45" cy="40" r="6.5" fill="#e879f9"/>
            </svg>
          </span>
          <div class="side-brand-txt">
            <strong>Mero <span>Console</span></strong>
            <small>إدارة التراخيص</small>
          </div>
        </div>
        <nav class="side-nav" id="sideNav">
          ${routes.map(r => `<a href="#/${r.path}" data-route="${r.path}">
            <span class="ni">${r.icon}</span><span>${r.label}</span></a>`).join('')}
        </nav>
        <div class="side-foot">
          <button class="btn btn-ghost btn-sm" id="btnLogout">${ICONS.power} خروج</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="topbar-title">
            <h2 id="viewTitle">نظرة عامة</h2>
            <span class="muted" id="viewSub"></span>
          </div>
          <div class="topbar-actions">
            <span class="server-chip mono" id="srvChip"></span>
            <button class="icon-btn" id="btnRefresh" title="تحديث">${ICONS.refresh}</button>
          </div>
        </header>
        <section class="view" id="view"></section>
      </div>
    </div>`;

  const chip = root.querySelector('#srvChip');
  if (chip) chip.textContent = api.credentials.server.replace(/^https?:\/\//, '');

  root.querySelector('#btnLogout').addEventListener('click', () => {
    api.logout();
    location.hash = '';
    renderGate(root, null);
  });

  root.querySelector('#btnRefresh').addEventListener('click', () => route(root));
  route(root);
}

function route(root) {
  if (!api.credentials.token) { renderGate(root, null); return; }
  const path = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
  const target = routes.find(r => r.path === path) || routes[0];

  if (typeof currentCleanup === 'function') currentCleanup();
  currentCleanup = null;

  root.querySelectorAll('#sideNav a').forEach(a =>
    a.classList.toggle('active', a.dataset.route === target.path));
  root.querySelector('#viewTitle').textContent = target.label;
  root.querySelector('#viewSub').textContent = '';

  modules[target.path]().then(mod => {
    const view = mod.default;
    const host = root.querySelector('#view').cloneNode(false);
    root.querySelector('#view').replaceWith(host);
    host.innerHTML = view.render();
    currentCleanup = typeof view.mount === 'function' ? view.mount(host) : null;
  }).catch(err => {
    root.querySelector('#view').innerHTML =
      `<p class="empty">تعذّر تحميل العرض: ${esc(err.message)}</p>`;
  });
}

export function goto(path) {
  location.hash = `#/${path}`;
}
