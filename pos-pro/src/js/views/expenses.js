import { db, uid } from '../db.js';
import { esc, money, num, dmy, toast, modal, confirmDialog, ICONS } from '../utils.js';
import { monthKey, monthRange, monthLabel } from '../shared.js';

const KINDS = ['بنزين', 'صيانة', 'إيجار', 'كهرباء', 'إنترنت', 'رواتب', 'أخرى'];

function render() {
  return `
    <div class="page">
      <div class="page-head">
        <div><h3>المصروفات</h3><span class="muted" id="eCount"></span></div>
        <div class="head-actions">
          <button class="btn btn-primary btn-sm" id="btnNew">+ مصروف</button>
        </div>
      </div>
      <div class="filters">
        <label class="flabel">الشهر</label>
        <select id="fMonth" class="select"></select>
      </div>
      <div id="list"></div>
    </div>`;
}

function mount(root) {
  const sel = root.querySelector('#fMonth');
  const months = new Set([monthKey(Date.now())]);
  db.get().expenses.forEach(e => months.add(monthKey(e.date)));
  sel.innerHTML = [...months].sort().reverse().map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  sel.addEventListener('change', draw);
  root.querySelector('#btnNew').addEventListener('click', () => openForm(root));
  draw(root);
}

function draw(root) {
  const sel = root.querySelector('#fMonth');
  const key = sel.value;
  const { from, to } = monthRange(key);
  const data = db.get();
  const list = data.expenses
    .filter(e => new Date(e.date).getTime() >= from && new Date(e.date).getTime() <= to)
    .sort((a, b) => b.date - a.date);

  const total = list.reduce((s, e) => s + Number(e.amount || 0), 0);
  const byKind = {};
  list.forEach(e => { byKind[e.kind] = (byKind[e.kind] || 0) + Number(e.amount || 0); });

  root.querySelector('#eCount').textContent = `${list.length} مصروف · الإجمالي ${total.toFixed(2)} ${data.settings.currency}`;

  root.querySelector('#list').innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h4>توزيع المصروفات — ${monthLabel(key)}</h4></div>
        ${list.length ? `<div class="top-list">${Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
          <div class="top-row"><span class="nm">${esc(k)}</span><span class="tt">${money(v, data.settings.currency)}</span></div>`).join('')}</div>`
          : '<p class="empty">لا توجد مصروفات هذا الشهر</p>'}
      </div>
      <div class="panel">
        <div class="table-wrap thin">
          <table class="table">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr></thead>
            <tbody>${list.map(e => `
              <tr><td>${dmy(e.date)}</td><td>${esc(e.kind)}</td><td class="mono neg">${Number(e.amount).toFixed(2)}</td>
              <td>${esc(e.notes || '—')}</td>
              <td><button class="icon-btn danger" data-act="del" data-id="${e.id}">×</button></td></tr>`).join('')
              || '<tr><td colspan="5" class="empty">لا توجد مصروفات</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  root.querySelector('#list').querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!(await confirmDialog('حذف هذا المصروف؟', 'حذف', true))) return;
      db.update(d => { d.expenses = d.expenses.filter(e => e.id !== btn.dataset.id); });
      toast('تم الحذف');
      draw(root);
    });
  });
}

function openForm(root) {
  const m = modal({
    title: 'مصروف جديد',
    body: `
      <form id="xf" class="form-grid">
        <div class="field"><input id="amt" type="number" min="0" step="0.25" placeholder=" " dir="ltr" required><label for="amt">المبلغ</label></div>
        <div class="field"><input id="dt" type="date" placeholder=" " dir="ltr" value="${new Date().toISOString().slice(0, 10)}"><label for="dt">التاريخ</label></div>
        <div class="field">
          <select id="kind" class="select">${KINDS.map(k => `<option>${k}</option>`).join('')}</select>
          <label class="sel-label">النوع</label>
        </div>
        <div class="field"><input id="nte" placeholder=" "><label for="nte">ملاحظة</label></div>
      </form>`,
    footer: `<button class="btn btn-outline" data-close>إلغاء</button><button class="btn btn-primary" id="xSave">حفظ</button>`
  });
  m.root.querySelector('#xSave').addEventListener('click', () => {
    const amount = Number(m.root.querySelector('#amt').value) || 0;
    if (amount <= 0) { toast('أدخل مبلغًا', 'err'); return; }
    db.update(d => d.expenses.push({
      id: uid('exp'), amount, kind: m.root.querySelector('#kind').value,
      date: new Date(m.root.querySelector('#dt').value || Date.now()).getTime(),
      notes: m.root.querySelector('#nte').value.trim()
    }));
    m.close();
    toast('تم تسجيل المصروف', 'ok');
    draw(root);
  });
}

export default { render, mount };
