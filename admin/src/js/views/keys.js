import { api, PLANS, planLabel } from '../api.js';
import { esc, toast, modal, confirmDialog, ICONS, timeAgo } from '../utils.js';

let filter = { q: '', status: 'all', plan: 'all' };

function render() {
  return `
    <div class="page">
      <div class="page-head">
        <div><h3>مفاتيح الترخيص</h3><span class="muted">إصدار وإلغاء ومتابعة الأجهزة</span></div>
        <button class="btn btn-primary" id="btnNew">${ICONS.plus} إصدار دفعة مفاتيح</button>
      </div>

      <div class="filters">
        <div class="input-wrap grow">
          <span class="input-ico">${ICONS.search}</span>
          <input id="kSearch" value="${esc(filter.q)}" placeholder="ابحث بمفتاح أو ملاحظة…">
        </div>
        <select id="fStatus" class="select">
          <option value="all" ${filter.status === 'all' ? 'selected' : ''}>كل الحالات</option>
          <option value="active" ${filter.status === 'active' ? 'selected' : ''}>مفعّل</option>
          <option value="unused" ${filter.status === 'unused' ? 'selected' : ''}>غير مستخدم</option>
          <option value="revoked" ${filter.status === 'revoked' ? 'selected' : ''}>ملغى</option>
        </select>
        <select id="fPlan" class="select">
          <option value="all" ${filter.plan === 'all' ? 'selected' : ''}>كل الخطط</option>
          ${Object.keys(PLANS).map(p => `<option value="${p}" ${filter.plan === p ? 'selected' : ''}>${esc(planLabel(p))}</option>`).join('')}
        </select>
      </div>

      <div id="keysBody"><p class="empty">جارٍ التحميل…</p></div>
    </div>`;
}

function mount(root) {
  root.querySelector('#kSearch').addEventListener('input', e => {
    filter.q = e.target.value;
    load(root);
  });
  root.querySelector('#fStatus').addEventListener('change', e => { filter.status = e.target.value; load(root); });
  root.querySelector('#fPlan').addEventListener('change', e => { filter.plan = e.target.value; load(root); });
  root.querySelector('#btnNew').addEventListener('click', () => openCreate(root));

  load(root);
}

async function load(root) {
  const body = root.querySelector('#keysBody');
  if (!body) return;
  try {
    const { keys } = await api.keys();
    const q = filter.q.trim().toLowerCase();
    const list = keys.filter(k => {
      if (filter.status === 'active' && k.status !== 'active') return false;
      if (filter.status === 'revoked' && k.status !== 'revoked') return false;
      if (filter.status === 'unused' && (k.deviceCount || 0) > 0) return false;
      if (filter.plan !== 'all' && k.plan !== filter.plan) return false;
      if (!q) return true;
      return k.key.toLowerCase().includes(q) || String(k.note || '').toLowerCase().includes(q);
    });

    body.innerHTML = list.length ? `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>المفتاح</th><th>الخطة</th><th>الأجهزة</th><th>الحالة</th>
              <th>ملاحظة</th><th>أُنشئ</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${list.map(k => `
              <tr data-key="${esc(k.key)}">
                <td class="mono key">${esc(k.key)}</td>
                <td>${esc(planLabel(k.plan))}</td>
                <td class="mono">${k.deviceCount || 0}/${k.maxDevices}${k.revokedDevices?.length ? ` <span class="rev-badge" title="أجهزة ملغاة في انتظار إعادة التنشيط">+${k.revokedDevices.length} ملغاة</span>` : ''}</td>
                <td><span class="pill-mini ${k.status === 'active' ? 'ok' : 'off'}">${k.status === 'active' ? 'مفعّل' : 'ملغى'}</span></td>
                <td class="muted small">${esc(k.note || '—')}</td>
                <td class="muted small">${timeAgo(k.createdAt)}</td>
                <td class="row-actions">
                  <button class="icon-btn" data-act="copy" title="نسخ">${ICONS.copy}</button>
                  <button class="icon-btn" data-act="devices" title="الأجهزة">${ICONS.dash}</button>
                  <button class="icon-btn danger" data-act="revoke" title="إلغاء المفتاح" ${k.status === 'revoked' ? 'disabled' : ''}>${ICONS.trash}</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p class="empty">لا توجد مفاتيح مطابقة</p>';

    body.querySelector('.table').addEventListener('click', async e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const key = btn.closest('tr').dataset.key;
      const act = btn.dataset.act;

      if (act === 'copy') {
        try {
          await navigator.clipboard.writeText(key);
          toast('تم نسخ المفتاح', 'ok');
        } catch { toast('انسخ المفتاح يدويًا', 'err'); }
      }
      if (act === 'revoke') {
        if (!(await confirmDialog(`إلغاء المفتاح ${key}؟ سيتوقف عن العمل على كل الأجهزة.`, 'إلغاء المفتاح', true))) return;
        try {
          await api.revoke(key);
          toast('تم إلغاء المفتاح', 'ok');
          load(root);
        } catch (err) { toast(err.message, 'err'); }
      }
      if (act === 'devices') openDevices(root, key);
    });
  } catch (err) {
    body.innerHTML = `<p class="empty">تعذّر التحميل: ${esc(err.message)}</p>`;
  }
}

function openCreate(root) {
  const m = modal({
    title: 'إصدار دفعة مفاتيح',
    body: `
      <form id="genForm" class="form-grid">
        <div class="field">
          <input id="gCount" type="number" min="1" max="500" step="1" value="1" placeholder=" " dir="ltr" required>
          <label for="gCount">عدد المفاتيح</label>
        </div>
        <div class="field">
          <select id="gPlan" class="select">${Object.entries(PLANS).map(([k, v]) =>
            `<option value="${k}">${esc(v.label)} — ${v.devices} جهاز</option>`).join('')}</select>
          <label class="sel-label">الخطة</label>
        </div>
        <div class="field span2">
          <input id="gNote" placeholder=" ">
          <label for="gNote">ملاحظة (اسم العميل / رقم الطلب)</label>
        </div>
        <div class="key-out span2" id="genOut">اضغط "إصدار" لتوليد المفاتيح</div>
      </form>`,
    footer: `
      <button class="btn btn-outline" data-close>إغلاق</button>
      <button class="btn btn-primary" id="gGo">إصدار</button>
      <button class="btn btn-outline" id="gCopy" disabled>${ICONS.copy} نسخ الكل</button>`
  });

  let last = '';
  m.root.querySelector('#gGo').addEventListener('click', async () => {
    const count = Math.min(Math.max(Number(m.root.querySelector('#gCount').value) || 1, 1), 500);
    const plan = m.root.querySelector('#gPlan').value;
    const note = m.root.querySelector('#gNote').value.trim();
    try {
      const res = await api.createKeys(count, plan, note);
      last = res.keys.join('\n');
      m.root.querySelector('#genOut').textContent = last;
      m.root.querySelector('#gCopy').disabled = false;
      toast(`تم إصدار ${res.keys.length} مفتاح`, 'ok');
      load(root);
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  m.root.querySelector('#gCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(last);
      toast('تم نسخ المفاتيح', 'ok');
    } catch { toast('انسخها يدويًا', 'err'); }
  });
}

async function openDevices(root, key) {
  try {
    const { keys } = await api.keys();
    const k = keys.find(x => x.key === key);
    if (!k) return toast('المفتاح غير موجود', 'err');
    if (!k.devices?.length && !k.revokedDevices?.length) return toast('لا توجد أجهزة', 'err');

    const m = modal({
      title: `أجهزة المفتاح ${key}`,
      body: `
        ${k.devices?.length ? `
          <h5 class="modal-sub">أجهزة نشطة (${k.devices.length}/${k.maxDevices})</h5>
          <div class="held-list">${k.devices.map(d => `
            <div class="held-row" data-dev="${esc(d.id)}">
              <div>
                <strong class="mono small">${esc(String(d.id).slice(0, 28))}</strong>
                <span class="muted small">${d.name ? esc(d.name) + ' · ' : ''}نُشّط ${timeAgo(d.activatedAt)} · آخر ظهور ${timeAgo(d.lastSeen || d.activatedAt)}</span>
              </div>
              <button class="btn btn-danger btn-sm" data-act="drop">إلغاء التنشيط</button>
            </div>`).join('')}</div>` : '<p class="empty">لا توجد أجهزة نشطة</p>'}

        ${k.revokedDevices?.length ? `
          <h5 class="modal-sub warn">أجهزة ملغاة — تحتاج إعادة تنشيط منك (${k.revokedDevices.length})</h5>
          <div class="held-list">${k.revokedDevices.map(d => `
            <div class="held-row" data-dev="${esc(d.id)}">
              <div>
                <strong class="mono small">${esc(String(d.id).slice(0, 28))}</strong>
                <span class="muted small">أُلغي ${timeAgo(d.deactivatedAt)}</span>
              </div>
              <button class="btn btn-primary btn-sm" data-act="restore">إعادة تنشيط</button>
            </div>`).join('')}</div>` : ''}

        <p class="hint">الأجهزة الملغاة لا تستطيع تفعيل نفسها بالمفتاح، ولا تعود للعمل إلا بعد إعادة التنشيط من هنا.</p>`
    });

    m.root.addEventListener('click', async e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const deviceId = btn.closest('.held-row').dataset.dev;

      if (btn.dataset.act === 'drop') {
        if (!(await confirmDialog('إلغاء تنشيط هذا الجهاز؟ سيحتاج إعادة تنشيط منك ليعمل مرة أخرى.', 'إلغاء التنشيط', true))) return;
        try {
          await api.deactivate(key, deviceId);
          toast('تم إلغاء تنشيط الجهاز', 'ok');
          m.close();
          load(root);
        } catch (err) { toast(err.message, 'err'); }
      }

      if (btn.dataset.act === 'restore') {
        try {
          await api.reactivate(key, deviceId);
          toast('تمت إعادة تنشيط الجهاز', 'ok');
          m.close();
          load(root);
        } catch (err) {
          toast(err.message === 'device_limit_reached' ? 'لا توجد أماكن متاحة على هذا المفتاح' : err.message, 'err');
        }
      }
    });
  } catch (err) {
    toast(err.message, 'err');
  }
}

export default { render, mount };
