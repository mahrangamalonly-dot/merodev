import { db, pin, hashPin, exportJSON, importJSON } from '../db.js';
import { esc, toast, confirmDialog, printHTML } from '../utils.js';
import { maskKey } from '../license.js';

function render() {
  const data = db.get();
  const s = data.settings;
  const auto = navigator.onLine;

  return `
    <div class="page">
      <div class="page-head">
        <div><h3>الإعدادات</h3><span class="muted">بيانات النشاط · الطباعة · الأمان · البيانات</span></div>
        <button class="btn btn-primary" id="btnSave">حفظ التغييرات</button>
      </div>

      <div class="set-grid">
        <div class="panel">
          <h4>بيانات النشاط</h4>
          <div class="form-grid">
            <div class="field span2"><input id="biz" placeholder=" " value="${esc(s.businessName)}"><label for="biz">اسم المكتب</label></div>
            <div class="field"><input id="phone" placeholder=" " dir="ltr" value="${esc(s.phone)}"><label for="phone">الهاتف</label></div>
            <div class="field"><input id="wa" placeholder=" " dir="ltr" value="${esc(s.whatsapp)}"><label for="wa">رقم الواتساب (للفواتير)</label></div>
            <div class="field span2"><input id="addr" placeholder=" " value="${esc(s.address)}"><label for="addr">العنوان</label></div>
            <div class="field span2">
              <input id="logo" placeholder=" " dir="ltr" value="${esc(s.logo)}">
              <label for="logo">رابط الشعار (اختياري)</label>
            </div>
          </div>
        </div>

        <div class="panel">
          <h4>الطباعة</h4>
          <div class="form-grid">
            <div class="field">
              <select id="paper" class="select">
                ${['72mm', '80mm', 'A4'].map(p => `<option ${s.paper === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
              <label class="sel-label">حجم الورق</label>
            </div>
            <div class="field">
              <input id="cur" placeholder=" " value="${esc(s.currency)}">
              <label for="cur">العملة</label>
            </div>
          </div>
          <div class="set-actions">
            <button class="btn btn-outline btn-sm" id="btnTestPrint">تجربة الطباعة</button>
          </div>
        </div>

        <div class="panel">
          <h4>الأمان</h4>
          <div class="form-grid">
            <div class="field">
              <input id="lock" type="number" min="1" max="60" step="1" placeholder=" " dir="ltr" value="${s.autoLockMinutes}">
              <label for="lock">قفل تلقائي بعد (دقيقة)</label>
            </div>
            <div class="field">
              <input id="pinNew" type="password" maxlength="6" dir="ltr" placeholder=" " >
              <label for="pinNew">رقم سري جديد (اتركه فارغًا للإبقاء)</label>
            </div>
          </div>
          <p class="hint">الرقم السري مخزّن مشفّرًا (SHA-256) على هذا الجهاز فقط.</p>
          <div class="set-actions">
            <button class="btn btn-outline btn-sm" id="btnLockNow">اقفل الشاشة الآن</button>
          </div>
        </div>

        <div class="panel">
          <h4>الترخيص</h4>
          <div class="kv"><span>المفتاح</span><b class="mono">${esc(maskKey(data.license?.key))}</b></div>
          <div class="kv"><span>معرّف الجهاز</span><b class="mono small">${esc(data.deviceId)}</b></div>
          <div class="kv"><span>آخر تحقق</span><b>${data.license?.verifiedAt ? new Date(data.license.verifiedAt).toLocaleString('ar-EG') : '—'}</b></div>
          <div class="set-actions">
            <button class="btn btn-outline btn-sm" id="btnVerify">اختبار الاتصال بالسيرفر</button>
          </div>
          <p class="lic-status" id="licStatus" role="status"></p>
        </div>

        <div class="panel">
          <h4>البيانات والنسخ الاحتياطي</h4>
          <div class="kv"><span>الفواتير</span><b>${data.orders.length}</b></div>
          <div class="kv"><span>العملاء الآجل</span><b>${data.creditCustomers.length}</b></div>
          <div class="kv"><span>العملاء الشهريون</span><b>${data.monthlyCustomers.length}</b></div>
          <div class="kv"><span>الموظفين</span><b>${data.employees.length}</b></div>
          <div class="set-actions">
            <button class="btn btn-outline btn-sm" id="btnExport">تصدير نسخة</button>
            <button class="btn btn-outline btn-sm" id="btnImport">استعادة</button>
            <input type="file" id="file" accept=".json" hidden>
          </div>
          <div class="danger-zone">
            <span>تصفير كل البيانات</span>
            <button class="btn btn-danger btn-sm" id="btnReset">تصفير</button>
          </div>
        </div>
      </div>
    </div>`;
}

function mount(root) {
  root.querySelector('#btnSave').addEventListener('click', async () => {
    const newPin = root.querySelector('#pinNew').value.trim();
    db.update(d => {
      d.settings.businessName = root.querySelector('#biz').value.trim() || 'مكتب التوصيل';
      d.settings.phone = root.querySelector('#phone').value.trim();
      d.settings.whatsapp = root.querySelector('#wa').value.trim();
      d.settings.address = root.querySelector('#addr').value.trim();
      d.settings.logo = root.querySelector('#logo').value.trim();
      d.settings.paper = root.querySelector('#paper').value;
      d.settings.currency = root.querySelector('#cur').value.trim() || 'ج.م';
      d.settings.autoLockMinutes = Math.max(1, Number(root.querySelector('#lock').value) || 5);
    });
    if (newPin) {
      if (!/^\d{4,6}$/.test(newPin)) { toast('الرقم السري من 4 إلى 6 أرقام', 'err'); return; }
      pin.set(await hashPin(newPin));
      root.querySelector('#pinNew').value = '';
      toast('تم تحديث الرقم السري', 'ok');
    }
    toast('تم حفظ الإعدادات', 'ok');
  });

  root.querySelector('#btnTestPrint').addEventListener('click', () => {
    import('./invoice.js').then(m => {
      const order = {
        no: 0, date: Date.now(), customerName: 'عميل تجربة', phone: '01000000000',
        address: 'عنوان تجريبي', payment: 'نقدي', status: 'جديد',
        items: [{ name: 'صنف تجريبي', qty: 1, price: 50, total: 50 }],
        delivery: 20, discount: 0, total: 70, employeeId: '', notes: ''
      };
      import('../utils.js').then(u => u.printHTML(m.buildReceipt(order), db.get().settings.paper));
    });
  });

  root.querySelector('#btnLockNow').addEventListener('click', () => {
    sessionStorage.removeItem('mero.pro.session.v1');
    location.reload();
  });

  root.querySelector('#btnVerify').addEventListener('click', async () => {
    const data = db.get();
    const box = root.querySelector('#licStatus');
    box.textContent = 'جارٍ الاتصال…';
    box.className = 'lic-status';
    try {
      const res = await fetch(`${data.settings.licenseServer.replace(/\/+$/, '')}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: data.license.key, deviceId: data.deviceId })
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        db.update(d => { if (d.license) d.license.verifiedAt = Date.now(); });
        box.textContent = `الاتصال ناجح · الجهاز مسجّل (${body.plan || '—'})`;
        box.className = 'lic-status ok';
      } else {
        box.textContent = `فشل التحقق: ${body.error || res.status}`;
        box.className = 'lic-status bad';
      }
    } catch {
      box.textContent = 'تعذّر الوصول إلى السيرفر. تحقق من الإنترنت.';
      box.className = 'lic-status bad';
    }
  });

  root.querySelector('#btnExport').addEventListener('click', () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `mero-pro-backup-${new Date().toISOString().slice(0, 10)}.json`
    });
    a.click();
    URL.revokeObjectURL(a.href);
    toast('تم تصدير النسخة', 'ok');
  });

  const file = root.querySelector('#file');
  root.querySelector('#btnImport').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    if (!(await confirmDialog('سيتم استبدال كل البيانات الحالية. متابعة؟', 'استعادة', true))) return;
    try {
      importJSON(await f.text());
      toast('تمت الاستعادة', 'ok');
      setTimeout(() => location.reload(), 600);
    } catch {
      toast('الملف غير صالح', 'err');
    }
    file.value = '';
  });

  root.querySelector('#btnReset').addEventListener('click', async () => {
    if (!(await confirmDialog('سيتم حذف كل الفواتير والبيانات نهائيًا. لا يمكن التراجع!', 'تصفير كل شيء', true))) return;
    db.reset();
    location.reload();
  });
}

export default { render, mount };
