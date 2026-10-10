import { api } from '../api.js';
import { esc, toast, confirmDialog } from '../utils.js';

function render() {
  const { server, token } = api.credentials;
  return `
    <div class="page">
      <div class="page-head">
        <div><h3>الإعدادات</h3><span class="muted">اتصال اللوحة بسيرفر التراخيص</span></div>
      </div>

      <div class="set-grid">
        <div class="panel">
          <h4>اتصال السيرفر</h4>
          <div class="form-grid">
            <div class="field span2">
              <input id="pSrv" placeholder=" " dir="ltr" value="${esc(server)}">
              <label for="pSrv">عنوان السيرفر</label>
            </div>
            <div class="field span2">
              <input id="pTok" placeholder=" " dir="ltr" value="${esc(token)}">
              <label for="pTok">رمز الإدارة</label>
            </div>
          </div>
          <div class="set-actions">
            <button class="btn btn-primary" id="btnSave">حفظ واختبار</button>
          </div>
          <p class="hint">بعد تغيير العنوان أو الرمز سيتم إعادة تسجيل الدخول.</p>
        </div>

        <div class="panel">
          <h4>ربط تطبيق POS</h4>
          <p class="hint">في تطبيق POS على جهاز العميل: الإعدادات → الرخصة → حقل "سيرفر الترخيص" → ضع العنوان التالي:</p>
          <div class="key-out mono" id="srvUrl">${esc(server.replace(/\/+$/, '') + '/activate')}</div>
          <p class="hint">بهذه الطريقة لا يمكن توليد المفاتيح من التطبيق، وكل تفعيل يمر عبر هذا السيرفر.</p>
          <div class="danger-zone">
            <span>إنهاء الجلسة الحالية</span>
            <button class="btn btn-danger btn-sm" id="btnOut">خروج</button>
          </div>
        </div>
      </div>
    </div>`;
}

function mount(root) {
  root.querySelector('#btnSave').addEventListener('click', async () => {
    const server = root.querySelector('#pSrv').value.trim();
    const token = root.querySelector('#pTok').value.trim();
    api.save({ server, token });
    try {
      await api.keys();
      toast('تم الحفظ والاتصال بنجاح', 'ok');
    } catch {
      toast('تعذّر الاتصال. تحقق من العنوان والرمز.', 'err');
    }
  });

  root.querySelector('#btnOut').addEventListener('click', async () => {
    if (!(await confirmDialog('تسجيل الخروج من لوحة الإدارة؟', 'خروج', true))) return;
    api.logout();
    location.hash = '';
    location.reload();
  });
}

export default { render, mount };
