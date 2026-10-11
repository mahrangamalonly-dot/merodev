import { esc, ICONS } from '../utils.js';
import { db, session, pin, hashPin } from '../db.js';

function render() {
  const data = db.get();
  return `
    <div class="gate">
      <div class="gate-card">
        <div class="gate-brand">
          <span class="brand-mark">
            <svg viewBox="0 0 64 64" width="42" height="42" aria-hidden="true">
              <defs><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#e879f9"/>
              </linearGradient></defs>
              <rect x="2" y="2" width="60" height="60" rx="16" fill="#12081f" stroke="url(#lg2)" stroke-width="2"/>
              <path d="M18 18v10h28V18z" fill="url(#lg2)"/>
              <path d="M18 32h14v14H18z" fill="url(#lg2)" opacity=".75"/>
              <circle cx="45" cy="40" r="6.5" fill="#e879f9"/>
            </svg>
          </span>
          <h1>${esc(data.settings.businessName)}</h1>
          <p>أدخل الرقم السري للدخول</p>
        </div>
        <form id="loginForm" class="gate-form">
          <div class="input-wrap">
            <span class="input-ico">${ICONS.key}</span>
            <input id="pinInput" type="password" inputmode="numeric" maxlength="6" dir="ltr" placeholder="••••" required>
          </div>
          <button class="btn btn-primary btn-lg btn-block" type="submit">دخول</button>
          <p class="gate-error" id="loginErr" role="alert"></p>
        </form>
        <p class="hint">${data.orders.length} فاتورة مسجّلة على هذا الجهاز</p>
      </div>
    </div>`;
}

async function mount(root, onDone) {
  const form = root.querySelector('#loginForm');
  const err = root.querySelector('#loginErr');
  const input = root.querySelector('#pinInput');
  const stored = pin.get();
  input?.focus();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const value = input.value.trim();
    if (!/^\d{4,6}$/.test(value)) { err.textContent = 'الرقم السري من 4 إلى 6 أرقام.'; return; }

    const hash = await hashPin(value);
    const current = pin.get();

    if (!current) {
      pin.set(hash);
      session.set({ at: Date.now(), name: 'المدير' });
      onDone?.();
      return;
    }
    if (hash !== current) { err.textContent = 'الرقم السري غير صحيح.'; return; }

    session.set({ at: Date.now(), name: 'المدير' });
    onDone?.();
  });
}

export default { render, mount };
