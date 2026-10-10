import { esc, ICONS } from '../store.js';

function render() {
  return `
    <form id="loginForm" class="gate-form">
      <label for="uName" style="font-size:.8rem;color:var(--muted)">اسم المستخدم</label>
      <div class="input-wrap">
        <span class="ico">${ICONS.key}</span>
        <input id="uName" dir="ltr" placeholder="admin" autocomplete="username" required>
      </div>
      <label for="uPin" style="font-size:.8rem;color:var(--muted)">الرقم السري</label>
      <div class="input-wrap">
        <span class="ico">${ICONS.key}</span>
        <input id="uPin" type="password" inputmode="numeric" maxlength="6" dir="ltr" placeholder="••••" required>
      </div>
      <button class="btn btn-primary" type="submit" style="width:100%;margin-top:.5rem">دخول</button>
      <p class="err" id="loginErr" role="alert"></p>
    </form>`;
}

function mount(root, onDone) {
  const form = root.querySelector('#loginForm');
  const err = root.querySelector('#loginErr');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const u = root.querySelector('#uName').value.trim().toLowerCase();
    const p = root.querySelector('#uPin').value.trim();
    const user = db()?.users.find(x => x.username === u && x.pin === p && x.active);
    if (!user) { err.textContent = 'بيانات الدخول غير صحيحة.'; return; }
    sessionSet(user);
    onDone?.();
  });
}

function db() {
  try { return JSON.parse(localStorage.getItem('mero.pos.db.v1')); } catch { return null; }
}
function sessionSet(u) {
  sessionStorage.setItem('mero.pos.session.v1', JSON.stringify(u));
}

export default { render, mount };
