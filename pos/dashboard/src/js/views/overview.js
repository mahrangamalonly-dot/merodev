import { db, esc, money, filteredSales, ICONS } from '../store.js';

function render() {
  return '<div id="ov"></div>';
}

function mount(root) {
  draw(root);

  const onStorage = e => { if (e.key === 'mero.pos.db.v1') draw(root); };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

function draw(root) {
  const host = root.querySelector('#ov');
  if (!host) return;
  const data = db.get();
  if (!data) { host.innerHTML = '<p class="empty">لا توجد بيانات</p>'; return; }

  const sales = filteredSales('today');
  const week = filteredSales('week');
  const month = filteredSales('month');
  const cur = data.settings.currency;

  const sum = list => list.reduce((s, x) => s + x.total, 0);
  const profit = list => list.reduce((s, x) => s + (x.total - (x.costTotal || 0)), 0);

  const todayRev = sum(sales);
  const yesterdayStart = new Date(); yesterdayStart.setDate(yesterdayStart.getDate() - 1); yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(); yesterdayEnd.setHours(0, 0, 0, 0);
  const ySales = data.sales.filter(s => s.ts >= yesterdayStart.getTime() && s.ts < yesterdayEnd.getTime());
  const yRev = sum(ySales);
  const trend = yRev > 0 ? ((todayRev - yRev) / yRev) * 100 : null;

  const lowStock = data.products.filter(p => p.stock <= data.settings.lowStock);

  host.innerHTML = `
    <div class="kpis">
      <div class="kpi"><span>مبيعات اليوم</span><strong>${money(todayRev, cur)}</strong>
        ${trend !== null ? `<span class="trend ${trend >= 0 ? 'up' : 'down'}">${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend).toFixed(1)}% مقارنة بأمس</span>` : '<span class="trend muted">لا مقارنة</span>'}</div>
      <div class="kpi"><span>آخر 7 أيام</span><strong>${money(sum(week), cur)}</strong><span class="trend muted">${week.length} فاتورة</span></div>
      <div class="kpi"><span>آخر 30 يومًا</span><strong>${money(sum(month), cur)}</strong><span class="trend muted">${month.length} فاتورة</span></div>
      <div class="kpi"><span>ربح اليوم التقديري</span><strong class="${profit(sales) >= 0 ? 'pos' : 'neg'}">${money(profit(sales), cur)}</strong><span class="trend muted">${sales.length} فاتورة</span></div>
    </div>

    <div class="grid-2" style="margin-top:.9rem">
      <div class="panel">
        <div class="panel-head"><h4>مبيعات آخر 14 يومًا</h4><span class="muted">باليوم</span></div>
        ${bars14(data, cur)}
      </div>
      <div class="panel">
        <div class="panel-head"><h4>أعلى المنتجات</h4><span class="muted">آخر 30 يومًا</span></div>
        ${topProducts(data, cur)}
      </div>
    </div>

    <div class="grid-2" style="margin-top:.9rem">
      <div class="panel">
        <div class="panel-head"><h4>أحدث الفواتير</h4><span class="muted">${sales.length} اليوم</span></div>
        ${recent(data, cur)}
      </div>
      <div class="panel">
        <div class="panel-head"><h4>تنبيه المخزون</h4><span class="muted">${lowStock.length} منتج</span></div>
        ${lowStock.length ? `<div class="stock-grid">${lowStock.slice(0, 8).map(p => `
          <div class="stock-card">
            <span class="nm">${esc(p.name)}</span>
            <span class="qty">${p.stock} ${esc(p.unit || '')} متبقي</span>
          </div>`).join('')}</div>` : '<p class="empty">المخزون بحالة جيدة</p>'}
      </div>
    </div>`;
}

function bars14(data, cur) {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-CA');
    const from = new Date(d); from.setHours(0, 0, 0, 0);
    const to = new Date(d); to.setHours(23, 59, 59, 999);
    const total = data.sales
      .filter(s => s.ts >= from.getTime() && s.ts <= to.getTime())
      .reduce((s, x) => s + x.total, 0);
    days.push({ key, label: key, short: `${d.getDate()}/${d.getMonth() + 1}`, value: total });
  }
  const entries = days.filter(d => d.value > 0);
  if (!entries.length) return '<div class="chart-empty">لا توجد مبيعات بعد</div>';
  const max = Math.max(...entries.map(e => e.value), 1);
  return `<div class="chart">${days.map(d => `
    <div class="bar-col" title="${d.label}: ${money(d.value, cur)}">
      <span class="bar" style="height:${Math.max((d.value / max) * 100, 2)}%"></span>
      <small>${d.short}</small>
    </div>`).join('')}</div>`;
}

function topProducts(data, cur) {
  const { from, to } = { from: Date.now() - 29 * 86400000, to: Date.now() };
  const agg = {};
  data.sales.filter(s => s.ts >= from && s.ts <= to).forEach(s => s.items.forEach(i => {
    agg[i.name] = agg[i.name] || { qty: 0, total: 0 };
    agg[i.name].qty += i.qty;
    agg[i.name].total += i.qty * i.price;
  }));
  const list = Object.entries(agg).sort((a, b) => b[1].total - a[1].total).slice(0, 6);
  if (!list.length) return '<p class="empty">لا توجد مبيعات في آخر 30 يومًا</p>';
  return `<div class="top-list">${list.map(([name, v], i) => `
    <div class="top-row">
      <span class="rank">${i + 1}</span>
      <span class="nm">${esc(name)}</span>
      <span class="qt">${v.qty} وحدة</span>
      <span class="tt">${money(v.total, cur)}</span>
    </div>`).join('')}</div>`;
}

function recent(data, cur) {
  const sales = data.sales.slice().sort((a, b) => b.ts - a.ts).slice(0, 6);
  if (!sales.length) return '<p class="empty">لا توجد فواتير</p>';
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>#</th><th>الوقت</th><th>الكاشير</th><th>الأصناف</th><th>الإجمالي</th></tr></thead>
    <tbody>${sales.map(s => `
      <tr>
        <td class="mono">${s.invoiceNo}</td>
        <td>${new Date(s.ts).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</td>
        <td>${esc(s.userName)}</td>
        <td>${s.items.reduce((a, i) => a + i.qty, 0)}</td>
        <td class="mono strong">${money(s.total, cur)}</td>
      </tr>`).join('')}</tbody>
  </table></div>`;
}

export default { render, mount };
