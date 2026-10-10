import { api } from '../api.js';
import { esc, timeAgo, toast, confirmDialog } from '../utils.js';

let filter = 'pending';

function render() {
  return `
    <div class="page">
      <div class="page-head">
        <div><h3>طلبات النسخة التجريبية</h3><span class="muted">العميل يطلب من الموقع وإنتَ تصدر له مفتاح 7 أيام</span></div>
        <div class="range-tabs" id="filters">
          ${[['pending', 'قيد الانتظار'], ['fulfilled', 'تم الإصدار'], ['all', 'الكل']]
            .map(([k, l]) => `<button class="rtab ${filter === k ? 'active' : ''}" data-f="${k}">${l}</button>`).join('')}
        </div>
      </div>
      <div id="reqBody"><p class="empty">جارٍ التحميل…</p></div>
    </div>`;
}

function mount(root) {
  root.querySelector('#filters').addEventListener('click', e => {
    const b = e.target.closest('.rtab');
    if (!b) return;
    filter = b.dataset.f;
    soft(root);
  });
  load(root);
}

function soft(root) {
  const holder = document.createElement('div');
  holder.innerHTML = render();
  root.querySelector('.page').replaceWith(holder.firstElementChild);
  mount(root);
}

async function load(root) {
  const body = root.querySelector('#reqBody');
  if (!body) return;
  try {
    const { requests } = await api.call('/admin/requests', { method: 'GET' });
    const list = requests.filter(r => filter === 'all' || r.status === filter).slice().reverse();

    body.innerHTML = list.length ? `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>الاسم</th><th>التواصل</th><th>النشاط</th><th>الحالة</th><th>الوقت</th><th></th></tr>
          </thead>
          <tbody>
            ${list.map(r => `
              <tr data-id="${esc(r.id)}">
                <td><strong>${esc(r.name)}</strong></td>
                <td>
                  ${r.phone ? `<div class="mono">${esc(r.phone)}</div>` : ''}
                  ${r.email ? `<div class="muted small">${esc(r.email)}</div>` : ''}
                </td>
                <td>${esc(r.store || '—')}</td>
                <td>
                  <span class="pill-mini ${r.status === 'fulfilled' ? 'ok' : 'off'}">${r.status === 'fulfilled' ? 'تم الإصدار' : 'قيد الانتظار'}</span>
                  ${r.key ? `<div class="mono small" style="margin-top:.25rem">${esc(r.key)}</div>` : ''}
                </td>
                <td class="muted small">${timeAgo(r.createdAt)}</td>
                <td class="row-actions">
                  ${r.status === 'pending'
                    ? `<button class="btn btn-primary btn-sm" data-act="issue">إصدار مفتاح 7 أيام</button>`
                    : `<button class="btn btn-ghost btn-sm" data-act="copy">نسخ المفتاح</button>`}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p class="empty">لا توجد طلبات</p>';

    body.querySelector('.table').addEventListener('click', async e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.closest('tr').dataset.id;

      if (btn.dataset.act === 'issue') {
        btn.disabled = true;
        btn.textContent = 'جارٍ الإصدار...';
        try {
          const res = await api.call('/admin/requests', { method: 'POST', body: { requestId: id } });
          showKey(res.key, res.expiresAt);
          soft(root);
        } catch (err) {
          toast(err.message === 'already_fulfilled' ? 'تم إصدار مفتاح لهذا الطلب بالفعل' : err.message, 'err');
          btn.disabled = false;
          btn.textContent = 'إصدار مفتاح 7 أيام';
        }
      }

      if (btn.dataset.act === 'copy') {
        const key = btn.closest('tr').querySelector('.mono.small')?.textContent || '';
        try {
          await navigator.clipboard.writeText(key);
          toast('تم نسخ المفتاح', 'ok');
        } catch { toast('انسخ المفتاح يدويًا', 'err'); }
      }
    });
  } catch (err) {
    body.innerHTML = `<p class="empty">تعذّر التحميل: ${esc(err.message)}</p>`;
  }
}

function showKey(key, expiresAt) {
  const days = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt) - Date.now()) / 86400000)) : 7;
  import('../utils.js').then(({ modal }) => {
    modal({
      title: 'المفتاح التجريبي جاهز',
      body: `
        <p class="hint">ابعت المفتاح ده للعميل على الواتساب. صلاحية <strong>${days} أيام</strong> على جهاز واحد.</p>
        <div class="key-out mono" id="tk">${esc(key)}</div>`,
      footer: `
        <button class="btn btn-outline" data-close>إغلاق</button>
        <button class="btn btn-primary" id="tkCopy">نسخ</button>`
    });
    document.querySelector('#tkCopy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(key);
        toast('تم نسخ المفتاح', 'ok');
      } catch { toast('انسخ المفتاح يدويًا', 'err'); }
    });
  });
}

export default { render, mount };
