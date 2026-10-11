import { db, uid } from '../db.js';
import { esc, money, num, dmy, printHTML, toast, modal, confirmDialog, ICONS } from '../utils.js';
import { creditBalance, creditStatement } from '../shared.js';

let filter = { q: '', only: 'all' };

function render() {
  return `
    <div class="page">
      <div class="page-head">
        <div><h3>العملاء الآجل</h3><span class="muted" id="cCount"></span></div>
        <div class="head-actions">
          <button class="btn btn-outline btn-sm" id="btnPrintAll">طباعة ملخص الديون</button>
          <button class="btn btn-primary btn-sm" id="btnNew">+ عميل آجل</button>
        </div>
      </div>

      <div class="filters">
        <div class="input-wrap grow">
          <span class="input-ico">${ICONS.eye}</span>
          <input id="q" placeholder="ابحث بالاسم أو الهاتف…" value="${esc(filter.q)}">
        </div>
        <select id="only" class="select">
          <option value="all" ${filter.only === 'all' ? 'selected' : ''}>الكل</option>
          <option value="debt" ${filter.only === 'debt' ? 'selected' : ''}>عليهم رصيد</option>
          <option value="clear" ${filter.only === 'clear' ? 'selected' : ''}>مسدّد</option>
        </select>
      </div>

      <div id="list"></div>
    </div>`;
}

function mount(root) {
  root.querySelector('#q').addEventListener('input', e => { filter.q = e.target.value; draw(root); });
  root.querySelector('#only').addEventListener('change', e => { filter.only = e.target.value; draw(root); });
  root.querySelector('#btnNew').addEventListener('click', () => openForm(root));
  root.querySelector('#btnPrintAll').addEventListener('click', () => printAll(root));
  draw(root);
}

function list(root) {
  const data = db.get();
  const q = filter.q.trim().toLowerCase();
  return data.creditCustomers
    .map(c => ({ c, bal: creditBalance(c.id) }))
    .filter(({ c, bal }) => {
      if (filter.only === 'debt' && bal <= 0) return false;
      if (filter.only === 'clear' && bal > 0) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.phone.includes(q);
    })
    .sort((a, b) => b.bal - a.bal);
}

function draw(root) {
  const data = db.get();
  const rows = list(root);
  const total = rows.reduce((s, r) => s + r.bal, 0);
  root.querySelector('#cCount').textContent =
    `${rows.length} عميل · إجمالي المدين ${total.toFixed(2)} ${data.settings.currency}`;

  root.querySelector('#list').innerHTML = rows.length ? `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>العميل</th><th>الهاتف</th><th>العنوان</th><th>عدد الفواتير</th><th>الرصيد المدين</th><th></th></tr></thead>
        <tbody>${rows.map(({ c, bal }) => {
          const count = data.orders.filter(o => o.customerType === 'آجل' && o.customerId === c.id && o.status !== 'ملغي').length;
          return `<tr>
            <td><strong>${esc(c.name)}</strong></td>
            <td class="mono">${esc(c.phone)}</td>
            <td>${esc(c.address)}</td>
            <td class="mono">${count}</td>
            <td class="mono strong ${bal > 0 ? 'neg' : 'ok'}">${bal.toFixed(2)}</td>
            <td class="row-actions">
              <button class="btn btn-outline btn-sm" data-act="pay" data-id="${c.id}">تسجيل دفعة</button>
              <button class="icon-btn" data-act="stmt" data-id="${c.id}" title="كشف حساب">${ICONS.list}</button>
              <button class="icon-btn" data-act="edit" data-id="${c.id}" title="تعديل">${ICONS.edit}</button>
              <button class="icon-btn danger" data-act="del" data-id="${c.id}" title="حذف">${ICONS.trash}</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>` : '<p class="empty">لا يوجد عملاء آجل</p>';

  root.querySelector('#list').querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const cust = db.get().creditCustomers.find(c => c.id === id);
      if (!cust) return;

      if (act === 'pay') openPay(root, cust);
      if (act === 'stmt') statement(root, cust);
      if (act === 'edit') openForm(root, cust);
      if (act === 'del') {
        if (!(await confirmDialog(`حذف ${cust.name}؟ الفواتير تبقى موجودة بدون عميل.`, 'حذف', true))) return;
        db.update(d => { d.creditCustomers = d.creditCustomers.filter(c => c.id !== id); });
        toast('تم حذف العميل');
        draw(root);
      }
    });
  });
}

function openForm(root, cust) {
  const m = modal({
    title: cust ? 'تعديل عميل آجل' : 'عميل آجل جديد',
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
      if (cust) Object.assign(d.creditCustomers.find(c => c.id === cust.id), {
        name, phone, address: m.root.querySelector('#a').value.trim(), notes: m.root.querySelector('#nt').value.trim()
      });
      else d.creditCustomers.push({
        id: uid('crd'), name, phone, address: m.root.querySelector('#a').value.trim(),
        notes: m.root.querySelector('#nt').value.trim(), createdAt: Date.now(), active: true
      });
    });
    m.close();
    toast(cust ? 'تم تحديث العميل' : 'تمت إضافة العميل', 'ok');
    draw(root);
  });
}

function openPay(root, cust) {
  const bal = creditBalance(cust.id);
  const m = modal({
    title: `تسجيل دفعة — ${cust.name}`,
    body: `
      <div class="kv"><span>الرصيد الحالي</span><b class="neg">${bal.toFixed(2)}</b></div>
      <form id="pf" class="form-grid" style="margin-top:.8rem">
        <div class="field"><input id="amt" type="number" min="0" step="0.25" placeholder=" " dir="ltr" value="${bal > 0 ? bal.toFixed(2) : ''}" required><label for="amt">المبلغ</label></div>
        <div class="field"><input id="dt" type="date" placeholder=" " dir="ltr" value="${new Date().toISOString().slice(0, 10)}"><label for="dt">التاريخ</label></div>
        <div class="field span2"><input id="nte" placeholder=" "><label for="nte">ملاحظة</label></div>
      </form>`,
    footer: `<button class="btn btn-outline" data-close>إلغاء</button><button class="btn btn-primary" id="pSave">تسجيل</button>`
  });
  m.root.querySelector('#pSave').addEventListener('click', () => {
    const amount = Number(m.root.querySelector('#amt').value) || 0;
    if (amount <= 0) { toast('أدخل مبلغًا صحيحًا', 'err'); return; }
    db.update(d => d.settlements.push({
      id: uid('set'), kind: 'credit', customerId: cust.id, amount,
      date: new Date(m.root.querySelector('#dt').value || Date.now()).getTime(),
      notes: m.root.querySelector('#nte').value.trim()
    }));
    m.close();
    toast('تم تسجيل الدفعة', 'ok');
    draw(root);
  });
}

function statement(root, cust) {
  const rows = creditStatement(cust.id);
  const bal = creditBalance(cust.id);
  modal({
    title: `كشف حساب — ${cust.name}`,
    size: 'lg',
    body: `
      <div class="kv"><span>الهاتف</span><b class="mono">${esc(cust.phone)}</b></div>
      <div class="kv"><span>الرصيد الحالي</span><b class="${bal > 0 ? 'neg' : 'ok'}">${bal.toFixed(2)}</b></div>
      <div class="table-wrap" style="margin-top:.8rem">
        <table class="table">
          <thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
          <tbody>${rows.map(r => `
            <tr>
              <td>${dmy(r.date)}</td>
              <td>${esc(r.label)}</td>
              <td class="mono">${r.amount > 0 ? r.amount.toFixed(2) : '—'}</td>
              <td class="mono">${r.amount < 0 ? Math.abs(r.amount).toFixed(2) : '—'}</td>
              <td class="mono strong">${r.balance.toFixed(2)}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="empty">لا توجد حركات</td></tr>'}</tbody>
        </table>
      </div>`,
    footer: `<button class="btn btn-outline" data-close>إغلاق</button><button class="btn btn-primary" id="sPrint">طباعة الكشف</button>`
  });
  document.querySelector('#sPrint')?.addEventListener('click', () => {
    const data = db.get();
    printHTML(`
      <h3>${esc(data.settings.businessName)}</h3>
      <div class="center">كشف حساب عميل آجل — ${esc(cust.name)}</div>
      <div class="center">${esc(cust.phone)}</div>
      <div class="div"></div>
      <table><thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${dmy(r.date)}</td><td>${esc(r.label)}</td><td>${r.amount > 0 ? r.amount.toFixed(2) : '—'}</td><td>${r.amount < 0 ? Math.abs(r.amount).toFixed(2) : '—'}</td><td>${r.balance.toFixed(2)}</td></tr>`).join('')}</tbody></table>
      <div class="grand"><span>الرصيد المستحق</span><span>${bal.toFixed(2)} ${esc(data.settings.currency)}</span></div>`, data.settings.paper);
  });
}

function printAll(root) {
  const data = db.get();
  const rows = list(root);
  const total = rows.reduce((s, r) => s + r.bal, 0);
  printHTML(`
    <h3>${esc(data.settings.businessName)}</h3>
    <div class="center">ملخص ديون العملاء الآجل — ${dmy(Date.now())}</div>
    <div class="div"></div>
    <table><thead><tr><th>العميل</th><th>الهاتف</th><th>الرصيد</th></tr></thead>
    <tbody>${rows.map(({ c, bal }) => `<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${bal.toFixed(2)}</td></tr>`).join('') || '<tr><td colspan="3">لا توجد ديون</td></tr>'}</tbody></table>
    <div class="grand"><span>إجمالي المدين</span><span>${total.toFixed(2)} ${esc(data.settings.currency)}</span></div>`, data.settings.paper);
}

export default { render, mount };
