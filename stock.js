import { db, esc, money, filteredSales } from '../store.js';

function render() {
  return '<div id="st"></div>';
}

function mount(root) {
  draw(root);
}

function draw(root) {
  const host = root.querySelector('#st');
  const data = db.get();
  if (!data) { host.innerHTML = '<p class="empty">لا توجد بيانات</p>'; return; }
  const cur = data.settings.currency;

  const sold = {};
  data.sales.forEach(s => s.items.forEach(i => {
    sold[i.name] = (sold[i.name] || 0) + i.qty;
  }));

  const low = data.products.filter(p => p.stock <= data.settings.lowStock).sort((a, b) => a.stock - b.stock);
  const out = data.products.filter(p => p.stock === 0);
  const value = data.products.reduce((s, p) => s + p.stock * p.cost, 0);
  const retail = data.products.reduce((s, p) => s + p.stock * p.price, 0);

  const fast = data.products
    .map(p => ({ p, qty: sold[p.name] || 0 }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)
    .filter(x => x.qty > 0);

  host.innerHTML = `
    <div class="kpis">
      <div class="kpi"><span>قيمة المخزون (تكلفة)</span><strong>${money(value, cur)}</strong></div>
      <div class="kpi"><span>قيمته بالبيع</span><strong>${money(retail, cur)}</strong></div>
      <div class="kpi"><span>مخزون منخفض</span><strong style="color:var(--warn)">${low.length}</strong></div>
      <div class="kpi"><span>نفد المخزون</span><strong style="color:var(--bad)">${out.length}</strong></div>
    </div>

    <div class="panel" style="margin-top:.9rem">
      <div class="panel-head"><h4>تحتاج إعادة طلب</h4><span class="muted">${low.length} منتج</span></div>
      ${low.length ? `<div class="stock-grid">${low.map(p => `
        <div class="stock-card">
          <span class="nm">${esc(p.name)}</span>
          <span class="qty">${p.stock} ${esc(p.unit || '')} متبقي</span>
          <span class="cat">${sold[p.name] || 0} وحدة مباعة</span>
        </div>`).join('')}</div>` : '<p class="empty">كل المنتجات فوق حد التنبيه</p>'}
    </div>

    <div class="panel" style="margin-top:.9rem">
      <div class="panel-head"><h4>الأسرع حركة</h4><span class="muted">كل الفترات</span></div>
      ${fast.length ? `<div class="top-list">${fast.map((x, i) => `
        <div class="top-row">
          <span class="rank">${i + 1}</span>
          <span class="nm">${esc(x.p.name)}</span>
          <span class="qt">${x.qty} وحدة</span>
          <span class="tt" style="color:var(--warn)">${x.p.stock} متبقي</span>
        </div>`).join('')}</div>` : '<p class="empty">لا توجد مبيعات</p>'}
    </div>`;
}

export default { render, mount };