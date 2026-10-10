import { db, esc, money } from '../store.js';

function render() {
  return '<div id="pr"></div>';
}

function mount(root) {
  draw(root);
}

function draw(root) {
  const host = root.querySelector('#pr');
  const data = db.get();
  if (!data) { host.innerHTML = '<p class="empty">لا توجد بيانات</p>'; return; }
  const cur = data.settings.currency;

  const sold = {};
  data.sales.forEach(s => s.items.forEach(i => {
    sold[i.name] = sold[i.name] || { qty: 0, total: 0 };
    sold[i.name].qty += i.qty;
    sold[i.name].total += i.qty * i.price;
  }));

  const rows = data.products.map(p => {
    const s = sold[p.name] || { qty: 0, total: 0 };
    const margin = p.cost > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : 100;
    const cat = data.categories.find(c => c.id === p.categoryId);
    return { p, s, margin, cat };
  }).sort((a, b) => b.s.total - a.s.total);

  host.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h4>أداء المنتجات</h4><span class="muted">${rows.length} منتج · مرتبة بالإيراد</span></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>التكلفة</th><th>الهامش</th><th>الكمية المباعة</th><th>الإيراد</th><th>المخزون</th></tr></thead>
        <tbody>${rows.map(r => `
          <tr>
            <td><strong>${esc(r.p.name)}</strong></td>
            <td>${r.cat ? `<span class="cat-dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${r.cat.color};margin-inline-end:.35rem"></span>${esc(r.cat.name)}` : '—'}</td>
            <td class="mono">${money(r.p.price, cur)}</td>
            <td class="mono muted">${money(r.p.cost, cur)}</td>
            <td class="mono">${r.margin}%</td>
            <td class="mono">${r.s.qty}</td>
            <td class="mono strong">${money(r.s.total, cur)}</td>
            <td><span class="pill-mini ${r.p.stock === 0 ? 'off' : r.p.stock <= data.settings.lowStock ? 'warn' : 'ok'}">${r.p.stock}</span></td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}

export default { render, mount };