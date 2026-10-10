import { api } from '../api.js';
import { esc, ICONS, toast } from '../utils.js';

function render({ error = '' } = {}) {
  return `
    <div class="gate">
      <div class="gate-card glow">
        <div class="gate-brand">
          <span class="brand-mark">
            <svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true">
              <defs><linearGradient id="lgb" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#e879f9"/>
              </linearGradient></defs>
              <rect x="2" y="2" width="60" height="60" rx="16" fill="#12081f" stroke="url(#lgb)" stroke-width="2"/>
              <path d="M18 18v10h28V18z" fill="url(#lgb)"/>
              <path d="M18 32h14v14H18z" fill="url(#lgb)" opacity=".75"/>
              <circle cx="45" cy="40" r="6.5" fill="#e879f9"/>
            </svg>
          </span>
          <h1>Mero <span class="grad">Console</span></h1>
          <p>لوحة إدارة تراخيص Mero Dev POS</p>
        </div>
        <form id="loginForm" class="gate-form">
          <label for="srv">عنوان سيرفر التراخيص</label>
          <div class="input-wrap">
            <span class="input-ico">${ICONS.gear}</span>
            <input id="srv" dir="ltr" placeholder="https://license.merodev.com" value="${esc(api.credentials.server)}" required>
          </div>
          <label for="tok">رمز الإدارة (ADMIN_TOKEN)</label>
          <div class="input-wrap">
            <span class="input-ico">${ICONS.key}</span>
            <input id="tok" dir="ltr" placeholder="••••••••" required>
          </div>
          <button class="btn btn-primary btn-lg btn-block" type="submit">دخول</button>
          <p class="gate-error" id="loginErr" role="alert">${esc(error)}</p>
        </form>
        <p class="hint">الرمز هو نفسه <span class="mono">ADMIN_TOKEN</span> الموجود في ملف <span class="mono">.env</span> على سيرفر التراخيص.</p>
      </div>
    </div>`;
}

function mount(root) {
  const form = root.querySelector('#loginForm');
  const err = root.querySelector('#loginErr');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const server = root.querySelector('#srv').value.trim();
    const token = root.querySelector('#tok').value.trim();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'جارٍ التحقق...';

    api.save({ server, token });
    try {
      await api.ping(); // eslint-disable-line no-unused-vars
    } catch {
      btn.disabled = false;
      btn.textContent = 'دخول';
      err.textContent = 'تعذّر الاتصال بالسيرفر. تأكد من العنوان والرمز.';
      return;
    }
    try {
      await api.keys();
      toast('تم تسجيل الدخول', 'ok');
      location.hash = '#/dashboard';
      location.reload();
    } catch {
      api.logout();
      btn.disabled = false;
      btn.textContent = 'دخول';
      err.textContent = 'الرمز غير صحيح أو لا يملك صلاحية الإدارة.';
    }
  });
}

export default { render, mount };
