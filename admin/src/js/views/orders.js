import { api, PLANS, planLabel } from '../api.js';
import { esc, timeAgo } from '../utils.js';

function render() {
  return `
    <div class="page">
      <div class="page-head">
        <div><h3>الطلبات</h3><span class="muted">كل طلب مدفوع والمفاتيح الصادرة له</span></div>
      </div>
      <div id="ordersBody"><p class="empty">جارٍ التحميل…</p></div>
    </div>`;
}

function mount(root) {
  load(root);
}

async function load(root) {
  const body = root.querySelector('#ordersBody');
  if (!body) return;
  try {
    const { orders } = await api.keys();
    body.innerHTML = orders.length ? `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>رقم الطلب</th><th>العميل</th><th>الخطة</th><th>الأجهزة</th><th>المفتاح</th><th>المصدر</th><th>التاريخ</th></tr>
          </thead>
          <tbody>
            ${orders.slice().reverse().map(o => {
              const price = (PLANS[o.plan] || {}).price || 0;
              return `<tr>
                <td class="mono">${esc(o.id)}</td>
                <td class="mono">${esc(o.email || '—')}</td>
                <td>${esc(planLabel(o.plan))} <span class="muted small">×${o.devices}</span></td>
                <td class="mono">$${(price * o.devices).toLocaleString('en-US')}</td>
                <td class="mono key">${esc(o.key || '—')}</td>
                <td><span class="pill-mini ok">${esc(o.provider)}</span></td>
                <td class="muted small">${timeAgo(o.createdAt)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : '<p class="empty">لا توجد طلبات بعد</p>';
  } catch (err) {
    body.innerHTML = `<p class="empty">تعذّر التحميل: ${esc(err.message)}</p>`;
  }
}

export default { render, mount };
