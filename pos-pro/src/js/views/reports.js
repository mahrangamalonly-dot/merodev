import { db } from '../db.js';
import { esc, money, num, dmy, printHTML, toast, ICONS } from '../utils.js';
import { monthKey, monthRange, monthLabel, driverName, creditBalance } from '../shared.js';

let period = 'month';
let custom = '';

function render() {
  const now = new Date();
  return `
    <div class="page">
      <div class="page-head">
        <div><h3>التقارير</h3><span class="muted" id="rHead"></span></div>
        <div class="head-actions">
          <button class="btn btn-outline btn-sm" id="btnPrint">طباعة التقرير</button>
        </div>
      </div>

      <div class="filters">
        <select id="fPeriod" class="select">
          <option value="today" ${period === 'today' ? 'selected' : ''}>اليوم</option>
          <option value="day" ${period === 'day' ? 'selected' : ''}>يوم محدد</option>
          <option value="month" ${period === 'month' ? 'selected' : ''}>هذا الشهر</option>
          <option value="all" ${period === 'all' ? 'selected' : ''}>كل الوقت</option>
        </select>
        <input id="fDay" type="date" class="select" value="${custom || now.toISOString().slice(0, 10)}" style="${period === 'day' ? '' : 'display:none'}">
      </div>

      <div id="rep"></div>
    </div>`;
}

function mount(root) {
  root.querySelector('#fPeriod').addEventListener('change', e => {
    period = e.target.value;
    root.querySelector('#fDay').style.display = period === 'day' ? '' : 'none';
    draw(root);
  });
  root.querySelector('#fDay').addEventListener('change', e => { custom = e.target.value; draw(root); });
  root.querySelector('#btnPrint').addEventListener('click', () => printReport(root));
  draw(root);
}

function inRange(ts) {
  const now = new Date();
  if (period === 'today') return new Date(ts).toDateString() === now.toDateString();
  if (period === 'day') return new Date(ts).toISOString().slice(0, 10) === (custom || now.toISOString().slice(0, 10));
  if (period === 'month') { const { from, to } = monthRange(monthKey(now)); return ts >= from && ts <= to; }
  return true;
}

function label() {
  const now = new Date();
  if (period === 'today') return `يوم ${dmy(now)}`;
  if (period === 'day') return `يوم ${dmy(new Date(custom || now))}`;
  if (period === 'month') return monthLabel(monthKey(now));
  return 'كل الوقت';
}

function draw(root) {
  const data = db.get();
  const cur = data.settings.currency;
  const list = data.orders.filter(o => inRange(new Date(o.date).getTime()) && o.status !== 'ملغي');
  const cancelled = data.orders.filter(o => inRange(new Date(o.date).getTime()) && o.status === 'ملغي').length;
  const revenue = list.reduce((s, o) => s + Number(o.total || 0), 0);
  const delivery = list.reduce((s, o) => s + Number(o.delivery || 0), 0);
  const delivered = list.filter(o => o.status === 'تم التوصيل').length;
  const expenses = data.expenses.filter(e => inRange(new Date(e.date).getTime())).reduce((s, e) => s + Number(e.amount || 0), 0);

  const byDriver = {};
  list.forEach(o => {
    const k = driverName(o.employeeId);
    byDriver[k] = byDriver[k] || { orders: 0, delivered: 0, fees: 0 };
    byDriver[k].orders++;
    if (o.status === 'تم التوصيل') byDriver[k].delivered++;
    byDriver[k].fees += Number(o.delivery || 0);
  });

  const itemAgg = {};
  list.forEach(o => o.items.forEach(i => {
    itemAgg[i.name] = itemAgg[i.name] || { qty: 0, total: 0 };
    itemAgg[i.name].qty += Number(i.qty || 0);
    itemAgg[i.name].total += Number(i.total || 0);
  }));

  const payAgg = {};
  list.forEach(o => { payAgg[o.payment] = (payAgg[o.payment] || 0) + Number(o.total || 0); });

  const net = delivery - expenses;

  root.querySelector('#rHead').textContent = label();

  root.querySelector('#rep').innerHTML = `
    <div class="kpis">
      <div class="kpi"><span>إجمالي الفواتير</span><strong>${money(revenue, cur)}</strong></div>
      <div class="kpi"><span>تحصيل الدليفري</span><strong>${money(delivery, cur)}</strong></div>
      <div class="kpi"><span>عدد الفواتير</span><strong>${num(list.length)}</strong></div>
      <div class="kpi"><span>تم التوصيل</span><strong class="ok">${num(delivered)}</strong></div>
    </div>

    <div class="grid-2" style="margin-top:.9rem">
      <div class="panel">
        <div class="panel-head"><h4>المناديب</h4></div>
        <div class="table-wrap thin">
          <table class="table">
            <thead><tr><th>المندوب</th><th>طلبات</th><th>تم التوصيل</th><th>دليفري</th></tr></thead>
            <tbody>${Object.entries(byDriver).map(([n, d]) => `
              <tr><td>${esc(n)}</td><td class="mono">${d.orders}</td><td class="mono">${d.delivered}</td><td class="mono">${d.fees.toFixed(2)}</td></tr>`).join('')
              || '<tr><td colspan="4" class="empty">لا توجد بيانات</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h4>طرق الدفع</h4></div>
        <div class="legend">${Object.entries(payAgg).map(([k, v], i) => `
          <div class="legend-row"><span class="sw" style="background:${['#a855f7', '#e879f9', '#38bdf8', '#34d399', '#fbbf24'][i % 5]}"></span>
          <span class="nm">${esc(k)}</span><span class="vl">${money(v, cur)}</span>
          <span class="pc">${revenue ? ((v / revenue) * 100).toFixed(0) : 0}%</span></div>`).join('')
          || '<p class="empty">لا توجد بيانات</p>'}</div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:.9rem">
      <div class="panel">
        <div class="panel-head"><h4>أعلى الأصناف</h4></div>
        ${Object.keys(itemAgg).length ? `<div class="top-list">${Object.entries(itemAgg).sort((a, b) => b[1].total - a[1].total).slice(0, 8).map(([n, v], i) => `
          <div class="top-row"><span class="rank">${i + 1}</span><span class="nm">${esc(n)}</span>
          <span class="qt">${v.qty}</span><span class="tt">${money(v.total, cur)}</span></div>`).join('')}</div>`
          : '<p class="empty">لا توجد أصناف</p>'}
      </div>

      <div class="panel">
        <div class="panel-head"><h4>الملخص المالي</h4></div>
        <div class="stat-list">
          <div class="stat-row"><span>تحصيل الدليفري</span><strong>${money(delivery, cur)}</strong></div>
          <div class="stat-row"><span>المصروفات</span><strong class="neg">${money(expenses, cur)}</strong></div>
          <div class="stat-row"><span>فواتير ملغاة</span><strong>${num(cancelled)}</strong></div>
          <div class="stat-row big"><span>الصافي</span><strong class="${net >= 0 ? 'ok' : 'neg'}">${money(net, cur)}</strong></div>
        </div>
        <div class="div"></div>
        <div class="stat-list">
          <div class="stat-row"><span>رصيد العملاء الآجل (كامل)</span><strong class="neg">${money(data.creditCustomers.reduce((s, c) => s + creditBalance(c.id), 0), cur)}</strong></div>
          <div class="stat-row"><span>عدد العملاء الآجل</span><strong>${num(data.creditCustomers.length)}</strong></div>
          <div class="stat-row"><span>عدد العملاء الشهريين</span><strong>${num(data.monthlyCustomers.length)}</strong></div>
        </div>
      </div>
    </div>`;
}

function printReport(root) {
  const data = db.get();
  const cur = data.settings.currency;
  const list = data.orders.filter(o => inRange(new Date(o.date).getTime()) && o.status !== 'ملغي');
  const revenue = list.reduce((s, o) => s + Number(o.total || 0), 0);
  const delivery = list.reduce((s, o) => s + Number(o.delivery || 0), 0);
  const expenses = data.expenses.filter(e => inRange(new Date(e.date).getTime())).reduce((s, e) => s + Number(e.amount || 0), 0);
  printHTML(`
    <h3>${esc(data.settings.businessName)}</h3>
    <div class="center">تقرير ${label()}</div>
    <div class="div"></div>
    <div class="stat"><span>إجمالي الفواتير</span><span>${revenue.toFixed(2)}</span></div>
    <div class="stat"><span>تحصيل الدليفري</span><span>${delivery.toFixed(2)}</span></div>
    <div class="stat"><span>عدد الفواتير</span><span>${list.length}</span></div>
    <div class="stat"><span>تم التوصيل</span><span>${list.filter(o => o.status === 'تم التوصيل').length}</span></div>
    <div class="stat"><span>المصروفات</span><span>${expenses.toFixed(2)}</span></div>
    <div class="stat"><span>الصافي</span><span>${(delivery - expenses).toFixed(2)}</span></div>
    <div class="div"></div>
    <table><thead><tr><th>#</th><th>العميل</th><th>المندوب</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
    <tbody>${list.map(o => `<tr><td>${o.no}</td><td>${esc(o.customerName)}</td><td>${esc(driverName(o.employeeId))}</td><td>${Number(o.total).toFixed(0)}</td><td>${esc(o.status)}</td></tr>`).join('') || '<tr><td colspan="5">لا توجد فواتير</td></tr>'}</tbody></table>`, data.settings.paper);
}

export default { render, mount };
