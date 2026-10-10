import { db } from '../db.js';
import { esc, plain, dateTime, toast, modal, ICONS } from '../utils.js';

let range = 'today';

function bounds() {
  const now = new Date();
  const start = new Date(now);
  if (range === 'today') start.setHours(0, 0, 0, 0);
  if (range === '7') start.setDate(start.getDate() - 6);
  if (range === '30') start.setDate(start.getDate() - 29);
  if (range === 'all') start.setFullYear(2000);
  return { from: start.getTime(), to: Date.now() };
}

function salesIn(data) {
  const { from, to } = bounds();
  return data.sales
    .filter(s => s.ts >= from && s.ts <= to)
    .sort((a, b) => b.ts - a.ts);
}

function render() {
  const data = db.get();
  const cur = data.settings.currency;
  const sales = salesIn(data);

  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const cost = sales.reduce((s, x) => s + (x.costTotal || 0), 0);
  const count = sales.length;
  const avg = count ? revenue / count : 0;
  const items = sales.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0);

  const byDay = {};
  sales.forEach(s => {
    const d = new Date(s.ts).toLocaleDateString('en-CA');
    byDay[d] = (byDay[d] || 0) + s.total;
  });
  const days = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  const max = Math.max(...days.map(d => d[1]), 1);

  const top = {};
  sales.forEach(s => s.items.forEach(i => {
    top[i.name] = top[i.name] || { qty: 0, total: 0 };
    top[i.name].qty += i.qty;
    top[i.name].total += i.qty * i.price;
  }));
  const topList = Object.entries(top).sort((a, b) => b[1].total - a[1].total).slice(0, 6);

  return `
    <div class="page">
      <div class="page-head">
        <div>
          <h3>التقارير</h3>
          <span class="muted">${count} فاتورة · ${items} صنف مُباع</span>
        </div>
        <div class="range-tabs" id="rangeTabs">
          ${[['today', 'اليوم'], ['7', '7 أيام'], ['30', '30 يومًا'], ['all', 'الكل']]
            .map(([k, l]) => `<button class="rtab ${range === k ? 'active' : ''}" data-r="${k}">${l}</button>`).join('')}
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><span>إجمالي المبيعات</span><strong>${plain(revenue)} <small>${esc(cur)}</small></strong></div>
        <div class="kpi"><span>صافي الربح التقديري</span><strong class="ok">${plain(revenue - cost)} <small>${esc(cur)}</small></strong></div>
        <div class="kpi"><span>عدد الفواتير</span><strong>${count}</strong></div>
        <div class="kpi"><span>متوسط الفاتورة</span><strong>${plain(avg)} <small>${esc(cur)}</small></strong></div>
      </div>

      <div class="rep-grid">
        <div class="panel">
          <h4>المبيعات اليومية</h4>
          ${days.length ? `
            <div class="chart">
              ${days.map(([d, v]) => `
                <div class="bar-col" title="${d} · ${plain(v)}">
                  <span class="bar" style="height:${Math.max((v / max) * 100, 3)}%"></span>
                  <small>${d.slice(5)}</small>
                </div>`).join('')}
            </div>` : '<p class="empty">لا توجد مبيعات في هذه الفترة</p>'}
        </div>

        <div class="panel">
          <h4>الأصناف الأكثر مبيعًا</h4>
          ${topList.length ? `<div class="top-list">
            ${topList.map(([name, v], i) => `
              <div class="top-row">
                <span class="rank">${i + 1}</span>
                <span class="tname">${esc(name)}</span>
                <span class="tqty">${v.qty}</span>
                <span class="ttotal">${plain(v.total)}</span>
              </div>`).join('')}
          </div>` : '<p class="empty">لا توجد بيانات</p>'}
        </div>
      </div>

      <div class="panel">
        <h4>أحدث الفواتير</h4>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>#</th><th>الوقت</th><th>الكاشير</th><th>الأصناف</th><th>الإجمالي</th><th>الطريقة</th><th></th></tr>
            </thead>
            <tbody>
              ${sales.length ? sales.slice(0, 40).map(s => `
                <tr>
                  <td class="mono">${s.invoiceNo}</td>
                  <td>${dateTime(s.ts)}</td>
                  <td>${esc(s.userName)}</td>
                  <td>${s.items.reduce((a, i) => a + i.qty, 0)}</td>
                  <td class="mono strong">${plain(s.total)}</td>
                  <td>${({ cash: 'نقدي', card: 'بطاقة', transfer: 'تحويل' })[s.method] || s.method}</td>
                  <td><button class="btn btn-ghost btn-sm" data-view="${s.id}">عرض</button></td>
                </tr>`).join('') : `<tr><td colspan="7" class="empty">لا توجد فواتير</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function mount(root) {
  root.querySelector('#rangeTabs').addEventListener('click', e => {
    const b = e.target.closest('.rtab');
    if (!b) return;
    range = b.dataset.r;
    softRender(root);
  });

  root.querySelector('.table').addEventListener('click', e => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    const s = db.get().sales.find(x => x.id === btn.dataset.view);
    if (s) viewSale(s);
  });
}

function softRender(root) {
  const panel = root.querySelector('.page');
  const holder = document.createElement('div');
  holder.innerHTML = render();
  panel.replaceWith(holder.firstElementChild);
  mount(root);
}function viewSale(sale) {
  const s = db.get().settings;
  modal({
    title: `فاتورة #${sale.invoiceNo}`,
    size: 'sm',
    body: `
      <div class="receipt">
        <h2>${esc(s.storeName)}</h2>
        <div class="c">${dateTime(sale.ts)} · ${esc(sale.userName)}</div>
        <div class="sep"></div>
        <table>
          <thead><tr><th>الصنف</th><th>كمية</th><th>الإجمالي</th></tr></thead>
          <tbody>${sale.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${plain(i.price * i.qty)}</td></tr>`).join('')}</tbody>
        </table>
        <div class="sep"></div>
        <div class="tot"><span>المجموع الفرعي</span><span>${plain(sale.subtotal)}</span></div>
        <div class="tot"><span>الخصم</span><span>-${plain(sale.discount)}</span></div>
        <div class="tot"><span>الضريبة</span><span>${plain(sale.tax)}</span></div>
        <div class="tot big"><span>الإجمالي</span><span>${plain(sale.total)} ${esc(s.currency)}</span></div>
        <div class="foot">${esc(s.receiptFooter)}</div>
      </div>`,
    footer: `<button class="btn btn-outline" data-close>إغلاق</button>`
  });
}

export default { render, mount };
