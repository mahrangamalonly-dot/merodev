import { esc, money, filteredSales, timeAgo } from '../store.js';

function render() {
  return '<div id="iv"></div>';
}

function mount(root) {
  draw(root);
}

function draw(root) {
  const host = root.querySelector('#iv');
  const data = JSON.parse(localStorage.getItem('mero.pos.db.v1') || 'null');
  if (!data) { host.innerHTML = '<p class="empty">لا توجد بيانات</p>'; return; }
  const cur = data.settings.currency;
  const sales = filteredSales();

  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const avg = sales.length ? revenue / sales.length : 0;

  host.innerHTML = `
    <div class="kpis">
      <div class="kpi"><span>عدد الفواتير</span><strong>${sales.length}</strong></div>
      <div class="kpi"><span>الإجمالي</span><strong>${money(revenue, cur)}</strong></div>
      <div class="kpi"><span>متوسط الفاتورة</span><strong>${money(avg, cur)}</strong></div>
      <div class="kpi"><span>أعلى فاتورة</span><strong>${money(sales.length ? Math.max(...sales.map(s => s.total)) : 0, cur)}</strong></div>
    </div>

    <div class="panel" style="margin-top:.9rem">
      <div class="panel-head"><h4>الفواتير</h4><span class="muted">${sales.length} فاتورة</span></div>
      ${sales.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>#</th><th>الوقت</th><th>الكاشير</th><th>الأصناف</th><th>الخصم</th><th>الضريبة</th><th>الإجمالي</th><th>الطريقة</th></tr></thead>
        <tbody>${sales.slice(0, 60).map(s => `
          <tr>
            <td class="mono">${s.invoiceNo}</td>
            <td>${timeAgo(s.ts)}</td>
            <td>${esc(s.userName)}</td>
            <td>${s.items.reduce((a, i) => a + i.qty, 0)} صنف</td>
            <td class="mono muted">${money(s.discount, cur)}</td>
            <td class="mono muted">${money(s.tax, cur)}</td>
            <td class="mono strong">${money(s.total, cur)}</td>
            <td>${({ cash: 'نقدي', card: 'بطاقة', transfer: 'تحويل' })[s.method] || s.method}</td>
          </tr>`).join('')}</tbody>
      </table></div>` : '<p class="empty">لا توجد فواتير في هذه الفترة</p>'}
    </div>`;
}

export default { render, mount };
