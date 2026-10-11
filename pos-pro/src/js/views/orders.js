import { db, uid } from '../db.js';
import { esc, money, num, dmy, printHTML, toast, modal, confirmDialog, ICONS } from '../utils.js';
import { CS, STATUSES, PAYMENTS, driverName, statusClass, monthKey, monthRange } from '../shared.js';
import { buildReceipt, sendWa, loadOrder } from './invoice.js';

let filter = { q: '', status: 'all', type: 'all', driver: 'all', period: 'month' };

function render() {
  return `
    <div class="page">
      <div class="page-head">
        <div><h3>الفواتير</h3><span class="muted" id="ordCount"></span></div>
        <div class="head-actions">
          <button class="btn btn-outline btn-sm" id="btnPrintDay">طباعة تقرير اليوم</button>
          <a class="btn btn-primary btn-sm" href="#/invoice">+ فاتورة جديدة</a>
        </div>
      </div>

      <div class="filters">
        <div class="input-wrap grow">
          <span class="input-ico">${ICONS.eye}</span>
          <input id="q" placeholder="ابحث برقم الفاتورة أو اسم العميل أو الهاتف…" value="${esc(filter.q)}">
        </div>
        <select id="fStatus" class="select">
          <option value="all">كل الحالات</option>
          ${STATUSES.map(s => `<option ${filter.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select id="fType" class="select">
          <option value="all">كل التصنيفات</option>
          ${[CS.NORMAL, CS.MONTHLY, CS.CREDIT].map(t => `<option ${filter.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <select id="fDriver" class="select"><option value="all">كل المناديب</option></select>
        <select id="fPeriod" class="select">
          <option value="today" ${filter.period === 'today' ? 'selected' : ''}>اليوم</option>
          <option value="month" ${filter.period === 'month' ? 'selected' : ''}>هذا الشهر</option>
          <option value="all" ${filter.period === 'all' ? 'selected' : ''}>كل الوقت</option>
        </select>
      </div>

      <div id="list"></div>
    </div>`;
}

function mount(root) {
  const data = db.get();
  const drv = root.querySelector('#fDriver');
  drv.innerHTML = '<option value="all">كل المناديب</option>' +
    data.employees.map(e => `<option value="${e.id}" ${filter.driver === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('');

  root.querySelector('#q').addEventListener('input', e => { filter.q = e.target.value; draw(root); });
  root.querySelector('#fStatus').addEventListener('change', e => { filter.status = e.target.value; draw(root); });
  root.querySelector('#fType').addEventListener('change', e => { filter.type = e.target.value; draw(root); });
  root.querySelector('#fDriver').addEventListener('change', e => { filter.driver = e.target.value; draw(root); });
  root.querySelector('#fPeriod').addEventListener('change', e => { filter.period = e.target.value; draw(root); });
  root.querySelector('#btnPrintDay').addEventListener('click', () => printDaily(root));
  draw(root);
}

function rows(root) {
  const data = db.get();
  const now = new Date();
  const { from, to } = monthRange(monthKey(now));
  const q = filter.q.trim().toLowerCase();

  return data.orders
    .filter(o => {
      if (filter.status !== 'all' && o.status !== filter.status) return false;
      if (filter.type !== 'all' && o.customerType !== filter.type) return false;
      if (filter.driver !== 'all' && o.employeeId !== filter.driver) return false;
      const t = new Date(o.date).getTime();
      if (filter.period === 'today' && new Date(o.date).toDateString() !== now.toDateString()) return false;
      if (filter.period === 'month' && (t < from || t > to)) return false;
      if (!q) return true;
      return String(o.no).includes(q) || o.customerName.toLowerCase().includes(q) || o.phone.includes(q);
    })
    .sort((a, b) => b.date - a.date);
}

function draw(root) {
  const data = db.get();
  const list = rows(root);
  const total = list.filter(o => o.status !== 'ملغي').reduce((s, o) => s + Number(o.total || 0), 0);
  const fees = list.filter(o => o.status !== 'ملغي').reduce((s, o) => s + Number(o.delivery || 0), 0);
  root.querySelector('#ordCount').textContent =
    `${list.length} فاتورة · الإجمالي ${total.toFixed(2)} ${data.settings.currency} · دليفري ${fees.toFixed(2)}`;

  root.querySelector('#list').innerHTML = list.length ? `
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>#</th><th>التاريخ</th><th>العميل</th><th>التصنيف</th><th>المندوب</th>
          <th>الدفع</th><th>الحالة</th><th>الإجمالي</th><th></th>
        </tr></thead>
        <tbody>${list.map(o => `
          <tr>
            <td class="mono">${o.no}</td>
            <td>${dmy(o.date)} <span class="muted small">${new Date(o.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></td>
            <td><strong>${esc(o.customerName)}</strong><div class="muted small mono">${esc(o.phone)}</div></td>
            <td>${esc(o.customerType)}</td>
            <td>${esc(driverName(o.employeeId))}</td>
            <td>${esc(o.payment)}</td>
            <td><button class="pill-mini ${statusClass(o.status)}" data-act="status" data-id="${o.id}">${esc(o.status)}</button></td>
            <td class="mono strong">${Number(o.total || 0).toFixed(2)}</td>
            <td class="row-actions">
              <button class="icon-btn" data-act="view" data-id="${o.id}" title="عرض">${ICONS.eye}</button>
              <button class="icon-btn" data-act="print" data-id="${o.id}" title="طباعة">${ICONS.print}</button>
              <button class="icon-btn" data-act="wa" data-id="${o.id}" title="واتساب">${ICONS.wa}</button>
              <button class="icon-btn" data-act="edit" data-id="${o.id}" title="تعديل">${ICONS.edit}</button>
              <button class="icon-btn danger" data-act="del" data-id="${o.id}" title="حذف">${ICONS.trash}</button>
            </td>
          </tr>`).join('')}</tbody>
      </table>
    </div>` : '<p class="empty">لا توجد فواتير مطابقة</p>';

  root.querySelector('#list').querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const order = db.get().orders.find(o => o.id === id);
      if (!order) return;

      if (act === 'view') viewOrder(order);
      if (act === 'print') printHTML(buildReceipt(order), db.get().settings.paper);
      if (act === 'wa') sendWa(order);
      if (act === 'edit') { loadOrder(id); location.hash = '#/invoice'; draw(root); }
      if (act === 'del') {
        if (!(await confirmDialog(`حذف الفاتورة #${order.no}؟`, 'حذف', true))) return;
        db.update(d => { d.orders = d.orders.filter(o => o.id !== id); });
        toast('تم حذف الفاتورة');
        draw(root);
      }
      if (act === 'status') {
        const next = STATUSES[(STATUSES.indexOf(order.status) + 1) % STATUSES.length];
        db.update(d => {
          const o = d.orders.find(x => x.id === id);
          if (o) { o.status = next; o.updatedAt = Date.now(); }
        });
        toast('الحالة: ' + next);
        draw(root);
      }
    });
  });
}

function viewOrder(o) {
  const s = db.get().settings;
  modal({
    title: `فاتورة #${o.no}`,
    size: 'sm',
    body: `
      <div class="kv"><span>التاريخ</span><b>${dmy(o.date)}</b></div>
      <div class="kv"><span>العميل</span><b>${esc(o.customerName)}</b></div>
      <div class="kv"><span>الهاتف</span><b class="mono">${esc(o.phone)}</b></div>
      <div class="kv"><span>العنوان</span><b>${esc(o.address)}</b></div>
      <div class="kv"><span>التصنيف</span><b>${esc(o.customerType)}</b></div>
      <div class="kv"><span>المندوب</span><b>${esc(driverName(o.employeeId))}</b></div>
      <div class="kv"><span>الدفع</span><b>${esc(o.payment)}</b></div>
      <div class="kv"><span>الحالة</span><b>${esc(o.status)}</b></div>
      <div class="div"></div>
      <table class="table small">
        <thead><tr><th>الصنف</th><th>كم</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>${o.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${i.price.toFixed(2)}</td><td>${i.total.toFixed(2)}</td></tr>`).join('')}
        ${o.delivery > 0 ? `<tr><td>دليفري</td><td>1</td><td>${o.delivery}</td><td>${o.delivery}</td></tr>` : ''}
        ${o.discount > 0 ? `<tr><td>خصم</td><td>—</td><td>${o.discount}</td><td>-${o.discount}</td></tr>` : ''}</tbody>
      </table>
      <div class="tot-row big"><span>الإجمالي</span><strong>${Number(o.total).toFixed(2)} ${esc(s.currency)}</strong></div>
      ${o.notes ? `<p class="muted small">ملاحظات: ${esc(o.notes)}</p>` : ''}`,
    footer: `<button class="btn btn-outline" data-close>إغلاق</button>
             <button class="btn btn-primary" id="mPrint">طباعة</button>`
  });
  document.querySelector('#mPrint')?.addEventListener('click', () => printHTML(buildReceipt(o), db.get().settings.paper));
}

function printDaily(root) {
  const data = db.get();
  const now = new Date();
  const list = data.orders.filter(o => new Date(o.date).toDateString() === now.toDateString() && o.status !== 'ملغي');
  const total = list.reduce((s, o) => s + Number(o.total || 0), 0);
  const fees = list.reduce((s, o) => s + Number(o.delivery || 0), 0);
  const delivered = list.filter(o => o.status === 'تم التوصيل').length;

  const byDriver = {};
  list.forEach(o => {
    const k = driverName(o.employeeId);
    if (!byDriver[k]) byDriver[k] = { count: 0, fees: 0, delivered: 0 };
    byDriver[k].count++;
    byDriver[k].fees += Number(o.delivery || 0);
    if (o.status === 'تم التوصيل') byDriver[k].delivered++;
  });

  const html = `
    <h3>${esc(data.settings.businessName)}</h3>
    <div class="center">تقرير يوم ${dmy(now)}</div>
    <div class="div"></div>
    <div class="stat"><span>عدد الفواتير</span><span>${list.length}</span></div>
    <div class="stat"><span>تم التوصيل</span><span>${delivered}</span></div>
    <div class="stat"><span>إجمالي الفواتير</span><span>${total.toFixed(2)}</span></div>
    <div class="stat"><span>إجمالي الدليفري</span><span>${fees.toFixed(2)}</span></div>
    <div class="div"></div>
    <h3>توزيع المناديب</h3>
    <table><thead><tr><th>المندوب</th><th>طلبات</th><th>تم التوصيل</th><th>دليفري</th></tr></thead>
    <tbody>${Object.entries(byDriver).map(([n, d]) => `<tr><td>${esc(n)}</td><td>${d.count}</td><td>${d.delivered}</td><td>${d.fees.toFixed(0)}</td></tr>`).join('') || '<tr><td colspan="4">لا توجد طلبات</td></tr>'}</tbody></table>
    <div class="div"></div>
    <h3>الفواتير</h3>
    <table><thead><tr><th>#</th><th>العميل</th><th>المندوب</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
    <tbody>${list.map(o => `<tr><td>${o.no}</td><td>${esc(o.customerName)}</td><td>${esc(driverName(o.employeeId))}</td><td>${Number(o.total).toFixed(0)}</td><td>${esc(o.status)}</td></tr>`).join('') || '<tr><td colspan="5">لا توجد فواتير اليوم</td></tr>'}</tbody></table>`;
  printHTML(html, data.settings.paper);
}

export default { render, mount };
