import { db, esc, money, filteredSales, buildBars } from '../store.js';

function render() {
  return '<div id="sl"></div>';
}

function mount(root) {
  draw(root);
}

function draw(root) {
  const host = root.querySelector('#sl');
  if (!host) return;
  const data = db.get();
  if (!data) { host.innerHTML = '<p class="empty">لا توجد بيانات</p>'; return; }

  const sales = filteredSales();
  const cur = data.settings.currency;
  const byDay = {};
  sales.forEach(s => {
    const key = new Date(s.ts).toLocaleDateString('en-CA');
    byDay[key] = (byDay[key] || 0) + s.total;
  });
  const dayEntries = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
    .map(([k, v]) => ({ label: k, short: `${k.slice(5, 7)}/${k.slice(8, 10)}`, value: v }));

  const byHour = Array.from({ length: 24 }, (_, h) => ({ label: `${h}:00`, short: `${h}`, value: 0 }));
  sales.forEach(s => { byHour[new Date(s.ts).getHours()].value += s.total; });
  const hourEntries = byHour.filter(h => h.value > 0);

  const byMethod = {};
  sales.forEach(s => {
    const k = ({ cash: 'نقدي', card: 'بطاقة', transfer: 'تحويل' })[s.method] || s.method;
    byMethod[k] = (byMethod[k] || 0) + s.total;
  });
  const total = Object.values(byMethod).reduce((a, b) => a + b, 0) || 1;

  host.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h4>المبيعات اليومية</h4><span class="muted">${dayEntries.length} يوم</span></div>
        ${buildBars(dayEntries, { format: v => money(v, cur) })}
      </div>
      <div class="panel">
        <div class="panel-head"><h4>طرق الدفع</h4><span class="muted">${money(total, cur)}</span></div>
        <div class="legend">${Object.entries(byMethod).map(([k, v], i) => `
          <div class="legend-row">
            <span class="sw" style="background:${['#a855f7', '#e879f9', '#38bdf8', '#34d399'][i % 4]}"></span>
            <span class="nm">${esc(k)}</span>
            <span class="vl">${money(v, cur)}</span>
            <span class="pc">${((v / total) * 100).toFixed(0)}%</span>
          </div>`).join('') || '<p class="empty">لا توجد بيانات</p>'}</div>
      </div>
    </div>

    <div class="panel" style="margin-top:.9rem">
      <div class="panel-head"><h4>المبيعات بالساعة</h4><span class="muted">الفترة المحددة</span></div>
      ${hourEntries.length ? buildBars(hourEntries, { format: v => money(v, cur) }) : '<p class="empty">لا توجد مبيعات في هذه الفترة</p>'}
    </div>`;
}

export default { render, mount };
