import { db, session } from '../db.js';
import { esc, toast, ICONS } from '../utils.js';

const roleLabel = { admin: 'مدير النظام', manager: 'مشرف', cashier: 'كاشير' };

function render() {
  const data = db.get();
  return `
    <div class="gate">
      <div class="gate-card glow">
        <div class="gate-brand">
          <span class="brand-mark">
            <svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true">
              <defs><linearGradient id="lg4" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#e879f9"/>
              </linearGradient></defs>
              <rect x="2" y="2" width="60" height="60" rx="16" fill="#12081f" stroke="url(#lg4)" stroke-width="2"/>
              <path d="M18 18v10h28V18z" fill="url(#lg4)"/>
              <path d="M18 32h14v14H18z" fill="url(#lg4)" opacity=".75"/>
              <circle cx="45" cy="40" r="6.5" fill="#e879f9"/>
            </svg>
          </span>
          <h1>Mero Dev <span class="grad">POS</span></h1>
          <p>${esc(data.settings.storeName)} · تسجيل الدخول</p>
        </div>
        <form id="loginForm" class="gate-form">
          <label for="uName">اسم المستخدم</label>
          <div class="input-wrap">
            <span class="input-ico">${ICONS.users}</span>
            <input id="uName" name="username" autocomplete="username" placeholder="admin" dir="ltr" required>
          </div>
          <label for="uPin">الرقم السري</label>
          <div class="input-wrap">
            <span class="input-ico">${ICONS.key}</span>
            <input id="uPin" name="pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••" dir="ltr" required>
          </div>
          <button class="btn btn-primary btn-lg btn-block" type="submit">دخول</button>
          <p class="gate-error" id="loginErr" role="alert"></p>
        </form>
        <div class="gate-accounts">
          <span>حسابات العرض التجريبي</span>
          <div class="demo-chips">
            <button class="chip" data-u="admin" data-p="1234" type="button">مدير · 1234</button>
            <button class="chip" data-u="cashier" data-p="1111" type="button">كاشير · 1111</button>
          </div>
        </div>
      </div>
      <p class="gate-foot">Mero Dev POS · جميع الحقوق محفوظة</p>
    </div>`;
}

function mount(root) {
  const form = root.querySelector('#loginForm');
  const err = root.querySelector('#loginErr');
  const u = root.querySelector('#uName');
  const p = root.querySelector('#uPin');

  root.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      u.value = chip.dataset.u;
      p.value = chip.dataset.p;
      err.textContent = '';
    });
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const user = db.get().users.find(
      x => x.username === u.value.trim().toLowerCase() && x.pin === p.value.trim() && x.active
    );
    if (!user) {
      err.textContent = 'اسم المستخدم أو الرقم السري غير صحيح.';
      return;
    }
    session.set(user);
    toast(`مرحبًا ${user.name}`, 'ok');
    if (!location.hash) location.hash = '#/pos';
    setTimeout(() => location.reload(), 350);
  });
}

export default { render, mount };
