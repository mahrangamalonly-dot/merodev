import { db, uid } from '../db.js';
import { esc, money, num, dmy, printHTML, toast, modal, confirmDialog, ICONS } from '../utils.js';
import { monthlyTotals, settledAmount, monthsList, monthKey, monthLabel, monthlyOrders } from '../shared.js';

let month = monthKey(Date.now());

function render() {
  return `
    <div class="page">
      <div class="page-head">
        <div><h3>العملاء الشهريون</h3><span class="muted">الفواتير تُجمّع خلال الشهر وتُصفّى بإجمالي آخره</span></div>
        <div class="head-actions">
          <button class="btn btn-outline btn-sm" id="btnPrint">طباعة كشف التصفية</button>
          <button class="btn btn-primary btn-sm" id="btnNew">+ عميل شهري</button>
        </div>
      </div>

      <div class="filters">
        <label class="flabel">الشهر</label>
        <select id="fMonth" class="select"></select>
        <span class="grow"></span>
        <div id="mSummary" class="mini-stats"></div>
      </div>

      <div id="list"></div>
    </div>`;
}

function mount(root) {
  const sel = root.querySelector('#fMonth');
  const months = monthsList();
  if (!months.includes(month)) months.unshift(month);
  sel.innerHTML = months.map(m => `<option value="${m}" ${m === month ? 'selected' : ''}>${monthLabel(m)}</option>`).join('');
  sel.addEventListener('change', e => { month = e.target.value; draw(root); });

  root.querySelector('#btnNew').addEventListener('click', () => openForm(root));
  root.querySelector('#btnPrint').addEventListener('click', () => printSettlement(root));
  draw(root);
}

function draw(root) {
  const data = db.get();
  const totals = monthlyTotals(month);
  const list = data.monthlyCustomers.map(c => ({
    c,
    total: totals[c.id] || 0,
    paid: settledAmount(c.id, month),
    orders: monthlyOrders(c.id, month).length
  })).sort((a, b) => (b.total - b.paid) - (a.total - a.paid));

  const grand = list.reduce((s, r) => s + r.total, 0);
  const paid = list.reduce((s, r) => s + r.paid, 0);
  const open = grand - paid;

  root.querySelector('#mSummary').innerHTML = `
    <div class="mini"><span>إجمالي الشهر</span><b>${money(grand, data.settings.currency)}</b></div>
    <div class="mini"><span>المسدّد</span><b class="ok">${money(paid, data.settings.currency)}</b></div>
    <div class="mini"><span>المتبقي</span><b class="${open > 0 ? 'neg' : 'ok'}">${money(open, data.settings.currency)}</b></div>`;

  root.querySelector('#list').innerHTML = list.length ? `
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>العميل</th><th>الهاتف</th><th>العنوان</th><th>عدد الفواتير</th>
          <th>إجمالي ${monthLabel(month)}</th><th>المسدّد</th><th>المتبقي</th><th></th>
        </tr></thead>
        <tbody>${list.map(({ c, total, paid: p, orders }) => {
          const rest = total - p;
          return `<tr>
            <td><strong>${esc(c.name)}</strong></td>
            <td class="mono">${esc(c.phone)}</td>
            <td>${esc(c.address)}</td>
            <td class="mono">${orders}</td>
            <td class="mono">${total.toFixed(2)}</td>
            <td class="mono ok">${p.toFixed(2)}</td>
            <td class="mono strong ${rest > 0 ? 'neg' : 'ok'}">${rest.toFixed(2)}</td>
            <td class="row-actions">
              <button class="btn btn-outline btn-sm" data-act="settle" data-id="${c.id}" ${rest > 0 ? '' : 'disabled'}>تسوية</button>
              <button class="icon-btn" data-act="stmt" data-id="${c.id}" title="كشف الحساب">${ICONS.list}</button>
              <button class="icon-btn" data-act="edit" data-id="${c.id}" title="تعديل">${ICONS.edit}</button>
              <button class="icon-btn danger" data-act="del" data-id="${c.id}" title="حذف">${ICONS.trash}</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>` : '<p class="empty">لا يوجد عملاء شهريون</p>';

  root.querySelector('#list').querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const cust = db.get().monthlyCustomers.find(c => c.id === id);
      if (!cust) return;

      if (act === 'settle') openSettle(root, cust, totals[cust.id] || 0);
      if (act === 'stmt') statement(cust);
      if (act === 'edit') openForm(root, cust);
      if (act === 'del') {
        if (!(await confirmDialog(`حذف ${cust.name}؟ الفواتير تبقى بدون عميل.`, 'حذف', true))) return;
        db.update(d => { d.monthlyCustomers = d.monthlyCustomers.filter(c => c.id !== id); });
        toast('تم الحذف');
        draw(root);
      }
    });
  });
}

function openForm(root, cust) {
  const m = modal({
    title: cust ? 'تعديل عميل شهري' : 'عميل شهري جديد',
    body: `
      <form id="cf" class="form-grid">
        <div class="field span2"><input id="n" placeholder=" " value="${esc(cust?.name || '')}" required><label for="n">الاسم</label></div>
        <div class="field"><input id="p" placeholder=" " dir="ltr" value="${esc(cust?.phone || '')}" required><label for="p">الهاتف</label></div>
        <div class="field"><input id="a" placeholder=" " value="${esc(cust?.address || '')}"><label for="a">العنوان</label></div>
        <div class="field span2"><input id="nt" placeholder=" " value="${esc(cust?.notes || '')}"><label for="nt">ملاحظات</label></div>
      </form>`,
    footer: `<button class="btn btn-outline" data-close>إلغاء</button><button class="btn btn-primary" id="cfSave">حفظ</button>`
  });
  m.root.querySelector('#cfSave').addEventListener('click', () => {
    const name = m.root.querySelector('#n').value.trim();
    const phone = m.root.querySelector('#p').value.trim();
    if (!name || !phone) { toast('أدخل الاسم والهاتف', 'err'); return; }
    db.update(d => {
      if (cust) Object.assign(d.monthlyCustomers.find(c => c.id === cust.id), {
        name, phone, address: m.root.querySelector('#a').value.trim(), notes: m.root.querySelector('#nt').value.trim()
      });
      else d.monthlyCustomers.push({
        id: uid('mth'), name, phone, address: m.root.querySelector('#a').value.trim(),
        notes: m.root.querySelector('#nt').value.trim(), createdAt: Date.now(), active: true
      });
    });
    m.close();
    toast(cust ? 'تم التحديث' : 'تمت الإضافة', 'ok');
    draw(root);
  });
}

function openSettle(root, cust, total) {
  const paid = settledAmount(cust.id, month);
  const rest = total - paid;
  const m = modal({
    title: `تسوية حساب ${monthLabel(month)} — ${cust.name}`,
    body: `
      <div class="kv"><span>إجمالي الشهر</span><b>${total.toFixed(2)}</b></div>
      <div class="kv"><span>المسدّد</span><b class="ok">${paid.toFixed(2)}</b></div>
      <div class="kv"><span>المتبقي</span><b class="neg">${rest.toFixed(2)}</b></div>
      <form id="sf" class="form-grid" style="margin-top:.8rem">
        <div class="field"><input id="amt" type="number" min="0" step="0.25" placeholder=" " dir="ltr" value="${rest.toFixed(2)}"><label for="amt">المبلغ المسدّد</label></div>
        <div class="field"><input id="nte" placeholder=" "><label for="nte">ملاحظة</label></div>
      </form>`,
    footer: `<button class="btn btn-outline" data-close>إلغاء</button><button class="btn btn-primary" id="sSave">تسجيل التسوية</button>`
  });
  m.root.querySelector('#sSave').addEventListener('click', () => {
    const amount = Number(m.root.querySelector('#amt').value) || 0;
    if (amount <= 0) { toast('أدخل مبلغًا', 'err'); return; }
    db.update(d => d.settlements.push({
      id: uid('set'), kind: 'monthly', customerId: cust.id, amount, month,
      date: Date.now(), notes: m.root.querySelector('#nte').value.trim() || `تسوية ${monthLabel(month)}`
    }));
    m.close();
    toast('تم تسجيل التسوية', 'ok');
    draw(root);
  });
}

function statement(cust) {
  const data = db.get();
  const rows = monthlyOrders(cust.id, month);
  const total = rows.reduce((s, o) => s + Number(o.total || 0), 0);
  const paid = settledAmount(cust.id, month);
  modal({
    title: `فواتير ${monthLabel(month)} — ${cust.name}`,
    size: 'lg',
    body: `
      <div class="kv"><span>الإجمالي</span><b>${total.toFixed(2)}</b></div>
      <div class="kv"><span>المسدّد</span><b class="ok">${paid.toFixed(2)}</b></div>
      <div class="kv"><span>المتبقي</span><b class="neg">${(total - paid).toFixed(2)}</b></div>
      <div class="table-wrap" style="margin-top:.8rem">
        <table class="table">
          <thead><tr><th>#</th><th>التاريخ</th><th>الأصناف</th><th>المندوب</th><th>الحالة</th><th>الإجمالي</th></tr></thead>
          <tbody>${rows.map(o => `
            <tr><td class="mono">${o.no}</td><td>${dmy(o.date)}</td>
            <td>${o.items.map(i => esc(i.name)).join('، ')}</td>
            <td>${esc(o.employeeId ? (data.employees.find(e => e.id === o.employeeId)?.name || '—') : '—')}</td>
            <td>${esc(o.status)}</td><td class="mono">${Number(o.total).toFixed(2)}</td></tr>`).join('')
            || '<tr><td colspan="6" class="empty">لا توجد فواتير هذا الشهر</td></tr>'}</tbody>
        </table>
      </div>`,
    footer: `<button class="btn btn-outline" data-close>إغلاق</button><button class="btn btn-primary" id="stPrint">طباعة</button>`
  });
  document.querySelector('#stPrint')?.addEventListener('click', () => {
    printHTML(`
      <h3>${esc(data.settings.businessName)}</h3>
      <div class="center">كشف حساب شهري — ${esc(cust.name)}</div>
      <div class="center">${monthLabel(month)}</div>
      <div class="div"></div>
      <table><thead><tr><th>#</th><th>التاريخ</th><th>الإجمالي</th></tr></thead>
      <tbody>${rows.map(o => `<tr><td>${o.no}</td><td>${dmy(o.date)}</td><td>${Number(o.total).toFixed(2)}</td></tr>`).join('')}</tbody></table>
      <div class="grand"><span>إجمالي الشهر</span><span>${total.toFixed(2)} ${esc(data.settings.currency)}</span></div>`, data.settings.paper);
  });
}

function printSettlement(root) {
  const data = db.get();
  const totals = monthlyTotals(month);
  const list = data.monthlyCustomers.map(c => ({
    c, total: totals[c.id] || 0, paid: settledAmount(c.id, month)
  }));
  const grand = list.reduce((s, r) => s + r.total, 0);
  const paid = list.reduce((s, r) => s + r.paid, 0);
  printHTML(`
    <h3>${esc(data.settings.businessName)}</h3>
    <div class="center">كشف تصفية العملاء الشهريين — ${monthLabel(month)}</div>
    <div class="div"></div>
    <table><thead><tr><th>العميل</th><th>الهاتف</th><th>الإجمالي</th><th>المسدّد</th><th>المتبقي</th></tr></thead>
    <tbody>${list.map(r => `<tr><td>${esc(r.c.name)}</td><td>${esc(r.c.phone)}</td><td>${r.total.toFixed(2)}</td><td>${r.paid.toFixed(2)}</td><td>${(r.total - r.paid).toFixed(2)}</td></tr>`).join('') || '<tr><td colspan="5">لا توجد بيانات</td></tr>'}</tbody></table>
    <div class="grand"><span>إجمالي المتبقي</span><span>${(grand - paid).toFixed(2)} ${esc(data.settings.currency)}</span></div>`, data.settings.paper);
}

export default { render, mount };
