import { db } from '../db.js';
import { LICENSE_SERVER as LICENSE_SERVER_DEFAULT } from '../config.js';
import { esc, toast, ICONS } from '../utils.js';
import { validateKey } from '../license.js';

const ERRORS = {
  key_not_found: 'هذا المفتاح غير مسجّل. تأكد من المفتاح أو تواصل مع البائع.',
  key_revoked: 'هذا المفتاح ملغى. تواصل مع البائع لاستبداله.',
  device_limit_reached: 'تم استخدام الحد الأقصى من الأجهزة لهذا المفتاح. تواصل مع البائع.',
  device_deactivated: 'تم إلغاء تنشيط هذا الجهاز. لا يمكن تفعيله مرة أخرى إلا بإعادة التنشيط من لوحة إدارة Mero Dev.',
  device_required: 'تعذّر التعرف على هذا الجهاز. أعد تشغيل التطبيق.',
  network: 'تعذّر الاتصال بسيرفر الترخيص. تحقق من الإنترنت وحاول مرة أخرى.',
  no_server: 'لم يتم تحديد سيرفر الترخيص. لا يمكن التفعيل بدون سيرفر.'
};

async function callServer(server, path, body) {
  const base = String(server || '').replace(/\/+$/, '');
  if (!base) return { error: 'no_server' };
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => null);
  if (!res) return { error: 'network' };
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok !== true) return { error: data.error || 'key_not_found', data };
  return { ok: true, data };
}

export { callServer };

export async function verifyOnline(server, key, deviceId) {
  return callServer(server, '/verify', { key, deviceId });
}

function render() {
  const data = db.get();
  return `
    <div class="gate">
      <div class="gate-card glow">
        <div class="gate-brand">
          <span class="brand-mark">
            <svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true">
              <defs><linearGradient id="lg5" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#e879f9"/>
              </linearGradient></defs>
              <rect x="2" y="2" width="60" height="60" rx="16" fill="#12081f" stroke="url(#lg5)" stroke-width="2"/>
              <path d="M18 18v10h28V18z" fill="url(#lg5)"/>
              <path d="M18 32h14v14H18z" fill="url(#lg5)" opacity=".75"/>
              <circle cx="45" cy="40" r="6.5" fill="#e879f9"/>
            </svg>
          </span>
          <h1>Mero Dev <span class="grad">POS</span></h1>
          <p>تفعيل النسخة على هذا الجهاز</p>
        </div>

        <div class="alert alert-lock">
          ${ICONS.key}
          <div>
            <strong>مطلوب مفتاح ترخيص</strong>
            <span>لا يوجد استخدام بدون مفتاح. يُصدر المفتاح من Mero Dev فقط ويعمل على عدد محدود من الأجهزة.</span>
          </div>
        </div>

        <form id="licForm" class="gate-form">
          <label for="licKey">مفتاح الترخيص</label>
          <div class="input-wrap">
            <span class="input-ico">${ICONS.key}</span>
            <input id="licKey" name="key" placeholder="MERO-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" dir="ltr" required>
          </div>
          <p class="hint">الصق المفتاح الذي اشتريته. يتم التحقق من السيرفر وربطه بهذا الجهاز تلقائيًا.</p>
          <button class="btn btn-primary btn-lg btn-block" type="submit">تفعيل النسخة</button>
          <p class="gate-error" id="licErr" role="alert"></p>
        </form>

        <details class="lic-adv">
          <summary>إعدادات متقدمة · سيرفر الترخيص</summary>
          <div class="lic-adv-body">
            <div class="field">
              <input id="srvUrl" placeholder=" " dir="ltr" value="${esc(data.settings.licenseServer || '')}">
              <label for="srvUrl">رابط السيرفر</label>
            </div>
            <div class="set-actions">
              <button class="btn btn-outline btn-sm" id="btnSaveSrv" type="button">حفظ الرابط</button>
              <button class="btn btn-ghost btn-sm" id="btnReset" type="button">استعادة الرابط الافتراضي</button>
            </div>
            <p class="hint">الرابط الافتراضي مُثبَّت داخل النسخة. لا تغيّره إلا بتعليمات من الدعم الفني.</p>
          </div>
        </details>
      </div>
      <p class="gate-foot">Mero Dev POS · التفاعل يتطلب ترخيصًا صحيحًا</p>
    </div>`;
}

function mount(root) {
  const form = root.querySelector('#licForm');
  const err = root.querySelector('#licErr');
  const input = root.querySelector('#licKey');
  const srvField = root.querySelector('#srvUrl');

  input?.focus();
  input?.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  });

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const key = input.value.trim().toUpperCase();
    const server = srvField.value.trim().replace(/\/+$/, '');

    if (!validateKey(key)) {
      err.textContent = 'صيغة المفتاح غير صحيحة. تأكد من النسخ.';
      return;
    }
    if (!server) {
      err.textContent = ERRORS.no_server;
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'جارٍ التحقق من السيرفر…';
    err.textContent = '';

    const result = await callServer(server, '/activate', {
      key,
      deviceId: db.get().deviceId,
      deviceName: navigator.userAgent.slice(0, 120)
    });

    if (!result.ok) {
      err.textContent = ERRORS[result.error] || 'فشل تفعيل المفتاح.';
      btn.disabled = false;
      btn.textContent = 'تفعيل النسخة';
      return;
    }

    db.update(d => {
      d.activated = true;
      d.license = { key, activatedAt: Date.now(), online: true, verifiedAt: Date.now(), plan: result.data.plan || null };
      d.settings.licenseServer = server;
    });
    toast('تم تفعيل النسخة بنجاح', 'ok');
    setTimeout(() => location.reload(), 500);
  });

  root.querySelector('#btnSaveSrv')?.addEventListener('click', () => {
    const value = root.querySelector('#srvUrl').value.trim().replace(/\/+$/, '');
    db.update(d => { d.settings.licenseServer = value; });
    toast(value ? 'تم حفظ رابط السيرفر' : 'تم إلغاء رابط السيرفر', 'ok');
  });

  root.querySelector('#btnReset')?.addEventListener('click', () => {
    db.update(d => { d.settings.licenseServer = LICENSE_SERVER_DEFAULT; });
    root.querySelector('#srvUrl').value = LICENSE_SERVER_DEFAULT;
    toast('تم استعادة الرابط الافتراضي', 'ok');
  });
}

export default { render, mount };
