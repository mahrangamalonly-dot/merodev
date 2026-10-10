import { api, PLANS, planLabel } from '../api.js';
import { esc, timeAgo, ICONS } from '../utils.js';

function render() {
  return `
    <div class="page">
      <div class="page-head">
        <div><h3>نظرة عامة</h3><span class="muted">ملخص المفاتيح والأجهزة والطلبات</span></div>
        <button class="btn btn-primary" id="btnGoKeys">${ICONS.plus} إصدار مفاتيح</button>
      </div>
      <div id="dashBody"><p class="empty">جارٍ تحميل البيانات…</p></div>
    </div>`;
}

function mount(root) {
  root.querySelector('#btnGoKeys').addEventListener('click', () => { location.hash = '#/keys'; });

  load(root);

  const t = setInterval(() => load(root), 30000);
  return () => clearInterval(t);
}

async function load(root) {
  const body = root.querySelector('#dashBody');
  if (!body) return;
  try {
    const { keys, orders } = await api.keys();
    const active = keys.filter(k => k.status === 'active').length;
    const revoked = keys.filter(k => k.status === 'revoked').length;
    const used = keys.reduce((s, k) => s + (k.deviceCount || 0), 0);
    const slots = keys.reduce((s, k) => s + k.maxDevices, 0);
    const revenue = orders.reduce((s, o) => s + ((PLANS[o.plan] || {}).price || 0) * o.devices, 0);

    body.innerHTML = `
      <div class="kpis">
        <div class="kpi"><span>مفاتيح مفعّلة</span><strong>${active}</strong></div>
        <div class="kpi"><span>مفاتيح ملغاة</span><strong class="bad">${revoked}</strong></div>
        <div class="kpi"><span>أجهزة مُنشّأة</span><strong>${used}/${slots}</strong></div>
        <div class="kpi"><span>إيراد الطلبات</span><strong>$${revenue.toLocaleString('en-US')}</strong></div>
      </div>

      <div class="rep-grid">
        <div class="panel">
          <h4>أحدث المفاتيح</h4>
          ${keys.length ? `<div class="table-wrap thin"><table class="table">
            <thead><tr><th>المفتاح</th><th>الخطة</th><th>الأجهزة</th><th>الحالة</th><th>أُنشئ</th></tr></thead>
            <tbody>${keys.slice(-8).reverse().map(k => `
              <tr>
                <td class="mono">${esc(k.key)}</td>
                <td>${esc(planLabel(k.plan))}</td>
                <td class="mono">${k.deviceCount}/${k.maxDevices}</td>
                <td><span class="pill-mini ${k.status === 'active' ? 'ok' : 'off'}">${k.status === 'active' ? 'مفعّل' : 'ملغى'}</span></td>
                <td class="muted">${timeAgo(k.createdAt)}</td>
              </tr>`).join('')}</tbody>
          </table></div>` : '<p class="empty">لا توجد مفاتيح بعد</p>'}
        </div>

        <div class="panel">
          <h4>أحدث الطلبات</h4>
          ${orders.length ? `<div class="table-wrap thin"><table class="table">
            <thead><tr><th>الطلب</th><th>الخطة</th><th>العدد</th><th>التاريخ</th></tr></thead>
            <tbody>${orders.slice(-8).reverse().map(o => `
              <tr>
                <td class="mono">${esc(o.id)}</td>
                <td>${esc(planLabel(o.plan))}</td>
                <td class="mono">${o.devices}</td>
                <td class="muted">${timeAgo(o.createdAt)}</td>
              </tr>`).join('')}</tbody>
          </table></div>` : '<p class="empty">لا توجد طلبات بعد</p>'}
        </div>
      </div>`;
  } catch (err) {
    body.innerHTML = `<p class="empty">تعذّر تحميل البيانات: ${esc(err.message)}</p>`;
  }
}

export default { render, mount };
