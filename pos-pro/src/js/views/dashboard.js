import { db } from '../db.js';
import { monthKey, monthLabel, monthRange, money, num, esc, orderTotal, creditBalance, monthlyTotals, settledAmount, employeeStats, driverName, statusClass, sameDay } from '../shared.js';

function render() {
  return '<div id="dash"></div>';
}

function mount(root) {
  draw(root);
  const iv = setInterval(() => draw(root), 60000);
  return () => clearInterval(iv);
}

function draw(root) {
  const host = root.querySelector('#dash');
  if (!host) return;
  const data = db.get();
  const now = new Date();
  const key = monthKey(now);
  const { from, to } = monthRange(key);

  const todayOrders = data.orders.filter(o => sameDay(o.date, now) && o.status !== 'ملغي');
  const todayDelivered = todayOrders.filter(o => o.status === 'تم التوصيل');
  const todayFees = todayOrders.reduce((s, o) => s + Number(o.delivery || 0), 0);
  const unassigned = todayOrders.filter(o => !o.employeeId);
  const monthOrders = data.orders.filter(o => new Date(o.date).getTime() >= from && new Date(o.date).getTime() <= to && o.status !== 'ملغي');
  const monthDelivery = monthOrders.reduce((s, o) => s + Number(o.delivery || 0), 0);
  const monthExpenses = data.expenses.filter(e => new Date(e.date).getTime() >= from && new Date(e.date).getTime() <= to)
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const creditTotal = data.creditCustomers.reduce((s, c) => s + creditBalance(c.id), 0);
  const monthTotals = monthlyTotals(key);
  const monthlyOpen = Object.entries(monthTotals)
    .filter(([id]) => settledAmount(id, key) < monthTotals[id])
    .reduce((s, [, v]) => s + v, 0);
  const monthlyTotal = Object.values(monthTotals).reduce((s, v) => s + v, 0);

  const drivers = data.employees.filter(e => e.role === 'مندوب توصيل' || !e.role)
    .map(e => ({ e, ...employeeStats(e.id, key) }))
    .sort((a, b) => b.fees - a.fees).slice(0, 5);

  const latest = data.orders.slice().sort((a, b) => b.date - a.date).slice(0, 6);

  host.innerHTML = `
    <div class="kpis">
      <div class="kpi"><span>طلبات اليوم</span><strong>${todayOrders.length}</strong></div>
      <div class="kpi"><span>تم التوصيل اليوم</span><strong class="ok">${todayDelivered.length}</strong></div>
      <div class="kpi"><span>تحصيل دليفري اليوم</span><strong>${money(todayFees)}</strong></div>
      <div class="kpi"><span>بدون مندوب</span><strong class="${unassigned.length ? 'warn' : ''}">${unassigned.length}</strong></div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h4>ملخص ${monthLabel(key)}</h4></div>
        <div class="stat-list">
          <div class="stat-row"><span>إجمالي الفواتير</span><strong>${money(monthDelivery)}</strong></div>
          <div class="stat-row"><span>عدد الفواتير</span><strong>${num(monthOrders.length)}</strong></div>
          <div class="stat-row"><span>المصروفات</span><strong class="neg">${money(monthExpenses)}</strong></div>
          <div class="stat-row big"><span>الصافي التقديري</span><strong>${money(monthDelivery - monthExpenses)}</strong></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h4>حسابات مفتوحة</h4></div>
        <div class="stat-list">
          <div class="stat-row"><span>رصيد العملاء الآجل</span><strong class="neg">${money(creditTotal)}</strong></div>
          <div class="stat-row"><span>فواتير الشهريين (${monthLabel(key)})</span><strong>${money(monthlyTotal)}</strong></div>
          <div class="stat-row"><span>متبقي تصفية الشهر</span><strong class="${monthlyOpen > 0 ? 'warn' : 'ok'}">${money(monthlyOpen)}</strong></div>
          <div class="stat-row"><span>عدد العملاء الآجل</span><strong>${num(data.creditCustomers.length)}</strong></div>
        </div>
        ${monthlyOpen > 0 ? `<a class="btn btn-outline btn-sm" href="#/monthly" style="margin-top:.8rem">تصفية حساب الشهر</a>` : ''}
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h4>أعلى المناديب هذا الشهر</h4></div>
        ${drivers.length ? `<div class="top-list">${drivers.map((d, i) => `
          <div class="top-row">
            <span class="rank">${i + 1}</span>
            <span class="nm">${esc(d.e.name)}</span>
            <span class="qt">${d.delivered}/${d.orders} طلب</span>
            <span class="tt">${money(d.fees)}</span>
          </div>`).join('')}</div>` : '<p class="empty">لا توجد مناديب</p>'}
      </div>

      <div class="panel">
        <div class="panel-head"><h4>أحدث الفواتير</h4><a class="muted" href="#/orders">عرض الكل</a></div>
        <div class="table-wrap thin">
          <table class="table">
            <thead><tr><th>#</th><th>العميل</th><th>المندوب</th><th>الحالة</th><th>الإجمالي</th></tr></thead>
            <tbody>${latest.map(o => `
              <tr>
                <td class="mono">${o.no}</td>
                <td>${esc(o.customerName)}</td>
                <td>${esc(driver(o.employeeId))}</td>
                <td><span class="pill-mini ${statusClass(o.status)}">${esc(o.status)}</span></td>
                <td class="mono">${money(orderTotal(o))}</td>
              </tr>`).join('') || '<tr><td colspan="5" class="empty">لا توجد فواتير</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function driver(id) { return driverName(id); }

export default { render, mount };
