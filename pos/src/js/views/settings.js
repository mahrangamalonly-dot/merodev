import { db } from '../db.js';
import { esc, toast, modal, confirmDialog, ICONS } from '../utils.js';
import { maskKey } from '../license.js';

function render() {
  const data = db.get();
  const s = data.settings;
  return `
    <div class="page">
      <div class="page-head">
        <div><h3>الإعدادات</h3><span class="muted">إعدادات المتجر والضريبة والفواتير</span></div>
        <button class="btn btn-primary" id="btnSaveAll">حفظ التغييرات</button>
      </div>

      <div class="set-grid">
        <div class="panel">
          <h4>بيانات المتجر</h4>
          <div class="form-grid">
            <div class="field span2">
              <input id="sStore" placeholder=" " value="${esc(s.storeName)}">
              <label for="sStore">اسم المتجر</label>
            </div>
            <div class="field">
              <input id="sPhone" placeholder=" " dir="ltr" value="${esc(s.phone)}">
              <label for="sPhone">الهاتف</label>
            </div>
            <div class="field">
              <input id="sCur" placeholder=" " value="${esc(s.currency)}">
              <label for="sCur">رمز العملة</label>
            </div>
            <div class="field span2">
              <input id="sAddr" placeholder=" " value="${esc(s.address)}">
              <label for="sAddr">العنوان</label>
            </div>
          </div>
        </div>

        <div class="panel">
          <h4>الضريبة والفواتير</h4>
          <div class="form-grid">
            <div class="field">
              <input id="sTax" type="number" min="0" max="100" step="0.5" placeholder=" " dir="ltr" value="${s.taxRate}">
              <label for="sTax">نسبة الضريبة %</label>
            </div>
            <div class="field">
              <input id="sLow" type="number" min="0" step="1" placeholder=" " dir="ltr" value="${s.lowStock}">
              <label for="sLow">حد تنبيه المخزون</label>
            </div>
            <div class="field span2">
              <input id="sWidth" type="number" min="58" max="112" step="1" placeholder=" " dir="ltr" value="${s.printerWidth}">
              <label for="sWidth">عرض الورق (mm)</label>
            </div>
            <div class="field span2">
              <input id="sFoot" placeholder=" " value="${esc(s.receiptFooter)}">
              <label for="sFoot">نص أسفل الفاتورة</label>
            </div>
          </div>
        </div>

        <div class="panel">
          <h4>الترخيص</h4>
          <div class="lic-box">
            <span class="muted">مفتاح هذا الجهاز</span>
            <strong class="mono">${esc(maskKey(data.license?.key))}</strong>
            <span class="muted small">${data.license?.plan ? 'الخطة: ' + esc(data.license.plan) : ''}${data.license?.verifiedAt ? ' · آخر تحقق: ' + esc(new Date(data.license.verifiedAt).toLocaleDateString('ar-EG')) : ''}</span>
            <span class="muted small">معرّف الجهاز: <span class="mono">${esc(data.deviceId)}</span></span>
          </div>
          <div class="form-grid">
            <div class="field span2">
              <input id="sSrv" placeholder=" " dir="ltr" value="${esc(s.licenseServer || '')}">
              <label for="sSrv">سيرفر الترخيص</label>
            </div>
          </div>
          <div class="set-actions">
            <button class="btn btn-outline" id="btnTestSrv">اختبار الاتصال</button>
            <button class="btn btn-outline" id="btnDeactivate">إلغاء تنشيط هذا الجهاز</button>
          </div>
          <p class="lic-status" id="licStatus" role="status"></p>
          <p class="hint">المفاتيح تُصدر من لوحة إدارة Mero Dev فقط، ولا يمكن استخدام النظام بدون مفتاح متحقَّق منه عبر السيرفر.</p>
        </div>

        <div class="panel">
          <h4>النسخ الاحتياطي</h4>
          <p class="hint">احتفظ بنسخة من بياناتك (منتجات، فواتير، إعدادات) بشكل دوري.</p>
          <div class="set-actions">
            <button class="btn btn-outline" id="btnBackup">تصدير نسخة</button>
            <button class="btn btn-outline" id="btnRestore">استعادة</button>
            <input type="file" id="fileRestore" accept=".json" hidden>
          </div>
          <div class="danger-zone">
            <span>إعادة تعيين كل البيانات</span>
            <button class="btn btn-danger btn-sm" id="btnReset">تصفير النظام</button>
          </div>
        </div>
      </div>
    </div>`;
}

function mount(root) {
  root.querySelector('#btnSaveAll').addEventListener('click', () => {
    db.update(d => {
      d.settings.storeName = root.querySelector('#sStore').value.trim() || 'متجري';
      d.settings.phone = root.querySelector('#sPhone').value.trim();
      d.settings.currency = root.querySelector('#sCur').value.trim() || 'ر.س';
      d.settings.address = root.querySelector('#sAddr').value.trim();
      d.settings.taxRate = Number(root.querySelector('#sTax').value) || 0;
      d.settings.lowStock = Number(root.querySelector('#sLow').value) || 0;
      d.settings.printerWidth = Number(root.querySelector('#sWidth').value) || 80;
      d.settings.receiptFooter = root.querySelector('#sFoot').value.trim();
      d.settings.licenseServer = root.querySelector('#sSrv').value.trim();
    });
    toast('تم حفظ الإعدادات', 'ok');
    rerender(root);
  });

  const setStatus = (text, ok = true) => {
    const el = root.querySelector('#licStatus');
    if (!el) return;
    el.textContent = text;
    el.className = `lic-status ${ok ? 'ok' : 'bad'}`;
  };

  root.querySelector('#btnTestSrv')?.addEventListener('click', async () => {
    const data = db.get();
    const url = root.querySelector('#sSrv').value.trim().replace(/\/+$/, '');
    if (!url) return setStatus('لم يتم تحديد عنوان السيرفر.', false);
    if (!data.license?.key || data.license.trial) return setStatus('لا يوجد مفتاح مفعّل على هذا الجهاز.', false);

    setStatus('جارٍ الاتصال…', true);
    try {
      const res = await fetch(`${url}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: data.license.key, deviceId: data.deviceId })
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        db.update(d => { if (d.license) d.license.verifiedAt = Date.now(); });
        setStatus(`الاتصال ناجح · الجهاز مسجّل (${body.plan || '—'})`, true);
      } else {
        setStatus(`فشل التحقق: ${body.error || res.status}`, false);
      }
    } catch (err) {
      const offline = navigator.onLine === false;
      setStatus(offline
        ? 'الجهاز غير متصل بالإنترنت حالياً.'
        : 'تعذّر الوصول إلى ' + url + ' (' + String(err && err.message || err).slice(0, 80) + ') تحقق من الإنترنت أو جرب شبكة أخرى.', false);
    }
  });

  root.querySelector('#btnDeactivate')?.addEventListener('click', async () => {
    const data = db.get();
    if (!data.settings.licenseServer || !data.license?.online) return;
    if (!(await confirmDialog('سيتم إلغاء تنشيط هذا الجهاز، ويمكنك تفعيل المفتاح على جهاز آخر. متابعة؟', { okText: 'إلغاء التنشيط', danger: true }))) return;
    const btn = root.querySelector('#btnDeactivate');
    btn.disabled = true;
    btn.textContent = 'جارٍ الإلغاء...';
    try {
      const res = await fetch(`${data.settings.licenseServer.replace(/\/+$/, '')}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: data.license.key, deviceId: data.deviceId })
      });
      if (!res.ok) throw new Error(String(res.status));
      db.update(d => { d.activated = false; d.license = null; });
      toast('تم إلغاء تنشيط الجهاز', 'ok');
      setTimeout(() => location.reload(), 700);
    } catch {
      btn.disabled = false;
      btn.textContent = 'إلغاء تنشيط هذا الجهاز';
      toast('تعذّر الاتصال بسيرفر الترخيص', 'err');
    }
  });

  root.querySelector('#btnBackup').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(db.get(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `mero-pos-backup-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
    toast('تم تصدير النسخة الاحتياطية', 'ok');
  });

  const file = root.querySelector('#fileRestore');
  root.querySelector('#btnRestore').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    if (!(await confirmDialog('سيتم استبدال كل البيانات الحالية. متابعة؟', { okText: 'استعادة', danger: true }))) return;
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      if (!parsed.settings || !Array.isArray(parsed.products)) throw new Error('bad');
      db.set(parsed);
      toast('تمت استعادة البيانات', 'ok');
      setTimeout(() => location.reload(), 600);
    } catch {
      toast('ملف النسخة الاحتياطية غير صالح', 'err');
    }
    file.value = '';
  });

  root.querySelector('#btnReset').addEventListener('click', async () => {
    if (!(await confirmDialog('سيتم حذف كل المنتجات والفواتير والإعدادات. لا يمكن التراجع!', { okText: 'تصفير كل شيء', danger: true }))) return;
    db.reset();
    location.reload();
  });
}

function rerender(root) {
  const panel = root.querySelector('.page');
  const holder = document.createElement('div');
  holder.innerHTML = render();
  panel.replaceWith(holder.firstElementChild);
  mount(root);
}

export default { render, mount };
