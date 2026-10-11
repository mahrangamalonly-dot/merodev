import { db, uid } from '../db.js';
import { esc, money, num, dtLocal, printHTML, toast, modal, ICONS } from '../utils.js';
import { CS, STATUSES, PAYMENTS, driverName, sameDay } from '../shared.js';

let draft = null;
let editId = null;

const blankDraft = () => ({
  date: dtLocal(Date.now()),
  customerName: '',
  phone: '',
  address: '',
  customerType: CS.NORMAL,
  employeeId: '',
  delivery: 0,
  payment: 'نقدي',
  discount: 0,
  notes: '',
  status: 'جديد',
  items: [{ name: '', qty: 1, price: 0 }]
});

function render() {
  const data = db.get();
  draft = draft || blankDraft();
  const drivers = data.employees.filter(e => !e.role || e.role === 'مندوب توصيل');
  const saved = data.products.slice(0, 40);

  return `
    <div class="inv-wrap">
      <form id="invForm" class="panel">
        <div class="panel-head">
          <h4>${editId ? 'تعديل فاتورة #' + editId : 'فاتورة جديدة'}</h4>
          <div class="head-actions">
            ${editId ? '<button type="button" class="btn btn-ghost btn-sm" id="btnCancelEdit">إلغاء التعديل</button>' : ''}
            <span class="mono muted">رقم الفاتورة: <b id="invNo">${data.nextInvoice}</b></span>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <input id="f-date" type="datetime-local" value="${draft.date}">
            <label for="f-date">التاريخ والوقت</label>
          </div>
          <div class="field">
            <input id="f-name" placeholder=" " value="${esc(draft.customerName)}" required>
            <label for="f-name">اسم العميل *</label>
          </div>
          <div class="field">
            <input id="f-phone" placeholder=" " dir="ltr" value="${esc(draft.phone)}" required>
            <label for="f-phone">رقم الهاتف *</label>
          </div>
          <div class="field">
            <input id="f-addr" placeholder=" " value="${esc(draft.address)}" required>
            <label for="f-addr">العنوان *</label>
          </div>
          <div class="field">
            <select id="f-type" class="select">
              ${[CS.NORMAL, CS.MONTHLY, CS.CREDIT].map(t => `<option ${draft.customerType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <label class="sel-label">تصنيف العميل</label>
          </div>
          <div class="field">
            <select id="f-pay" class="select">
              ${PAYMENTS.map(p => `<option ${draft.payment === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
            <label class="sel-label">طريقة الدفع</label>
          </div>
          <div class="field">
            <select id="f-driver" class="select">
              <option value="">— بدون مندوب —</option>
              ${drivers.map(d => `<option value="${d.id}" ${draft.employeeId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
            </select>
            <label class="sel-label">مندوب التوصيل</label>
          </div>
          <div class="field">
            <input id="f-delivery" type="number" min="0" step="1" placeholder=" " dir="ltr" value="${draft.delivery}">
            <label for="f-delivery">سعر الدليفري</label>
          </div>
          <div class="field">
            <input id="f-discount" type="number" min="0" step="1" placeholder=" " dir="ltr" value="${draft.discount}">
            <label for="f-discount">خصم</label>
          </div>
        </div>

        <div class="items-head">
          <h4>الأصناف</h4>
          <div class="items-tools">
            ${saved.length ? `<select id="savedItem" class="select sm"><option value="">+ إضافة صنف محفوظ</option>${saved.map(p => `<option value="${p.id}">${esc(p.name)} — ${p.price}</option>`).join('')}</select>` : ''}
            <button type="button" class="btn btn-outline btn-sm" id="btnAddRow">+ سطر</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table items">
            <thead><tr><th style="width:44%">الصنف</th><th style="width:14%">كمية</th><th style="width:18%">السعر</th><th style="width:18%">الإجمالي</th><th></th></tr></thead>
            <tbody id="itemsBody"></tbody>
          </table>
        </div>

        <div class="field" style="margin-top:.8rem">
          <input id="f-notes" placeholder=" " value="${esc(draft.notes)}">
          <label for="f-notes">ملاحظات</label>
        </div>

        <div class="inv-foot">
          <div class="totals">
            <div class="tot-row"><span>الأصناف</span><strong id="tItems">0</strong></div>
            <div class="tot-row"><span>الدليفري</span><strong id="tDelivery">0</strong></div>
            <div class="tot-row"><span>الخصم</span><strong id="tDisc">0</strong></div>
            <div class="tot-row big"><span>الإجمالي</span><strong id="tTotal">0</strong></div>
          </div>
          <div class="inv-actions">
            <button type="button" class="btn btn-outline" id="btnSaveOnly">حفظ</button>
            <button type="button" class="btn btn-primary" id="btnSavePrint">حفظ وطباعة</button>
            <button type="button" class="btn btn-wa" id="btnSaveWa">${ICONS.wa} حفظ وواتساب</button>
          </div>
        </div>
        <p class="gate-error" id="invErr" role="alert"></p>
      </form>

      <aside class="panel side-info">
        <h4>اختصارات</h4>
        <ul class="hint-list">
          <li><b>Ctrl+S</b> حفظ</li>
          <li><b>Ctrl+P</b> حفظ وطباعة</li>
          <li><b>Ctrl+Enter</b> حفظ وواتساب</li>
          <li><b>Ctrl+N</b> فاتورة جديدة</li>
        </ul>
        <h4 style="margin-top:1.2rem">تنبيهات</h4>
        <div id="invHints" class="hint-box"></div>
      </aside>
    </div>`;
}

function mount(root) {
  drawItems(root);
  calc(root);
  updateHints(root);
  bind(root);
}

function bind(root) {
  const data = db.get();
  const val = sel => root.querySelector(sel).value.trim();
  const nval = sel => Number(root.querySelector(sel).value) || 0;

  ['f-date', 'f-name', 'f-phone', 'f-addr', 'f-delivery', 'f-discount', 'f-notes'].forEach(id =>
    root.querySelector('#' + id).addEventListener('input', () => {
      draft[id.slice(2)] = id === 'f-delivery' || id === 'f-discount' ? nval('#' + id) : val('#' + id);
      calc(root);
      updateHints(root);
    }));

  root.querySelector('#f-type').addEventListener('change', e => {
    draft.customerType = e.target.value;
    if (e.target.value === CS.CREDIT) root.querySelector('#f-pay').value = 'آجل';
    if (e.target.value === CS.MONTHLY) root.querySelector('#f-pay').value = 'شهري';
    draft.payment = root.querySelector('#f-pay').value;
    updateHints(root);
  });
  root.querySelector('#f-pay').addEventListener('change', e => { draft.payment = e.target.value; });
  root.querySelector('#f-driver').addEventListener('change', e => { draft.employeeId = e.target.value; });

  root.querySelector('#btnAddRow').addEventListener('click', () => {
    draft.items.push({ name: '', qty: 1, price: 0 });
    drawItems(root);
    calc(root);
  });

  const savedSel = root.querySelector('#savedItem');
  savedSel?.addEventListener('change', e => {
    const p = data.products.find(x => x.id === e.target.value);
    if (!p) return;
    draft.items.push({ name: p.name, qty: 1, price: p.price });
    e.target.value = '';
    drawItems(root);
    calc(root);
  });

  root.querySelector('#btnSaveOnly').addEventListener('click', () => save(root, null));
  root.querySelector('#btnSavePrint').addEventListener('click', () => save(root, 'print'));
  root.querySelector('#btnSaveWa').addEventListener('click', () => save(root, 'wa'));

  root.querySelector('#btnCancelEdit')?.addEventListener('click', () => {
    editId = null;
    draft = blankDraft();
    render();
    mount(root);
  });

  const onKey = e => {
    if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); save(root, null); }
    if (e.ctrlKey && e.key.toLowerCase() === 'p') { e.preventDefault(); save(root, 'print'); }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); save(root, 'wa'); }
    if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); editId = null; draft = blankDraft(); render(); mount(root); }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

function drawItems(root) {
  const body = root.querySelector('#itemsBody');
  body.innerHTML = draft.items.map((it, i) => `
    <tr data-i="${i}">
      <td><input class="cell" data-k="name" value="${esc(it.name)}" placeholder="اسم الصنف"></td>
      <td><input class="cell mono" data-k="qty" type="number" min="1" step="1" value="${it.qty}"></td>
      <td><input class="cell mono" data-k="price" type="number" min="0" step="0.25" value="${it.price}"></td>
      <td class="mono" data-cell="total">${(it.qty * it.price).toFixed(2)}</td>
      <td><button type="button" class="icon-btn danger" data-k="del" title="حذف">×</button></td>
    </tr>`).join('');

  body.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => {
      const tr = e.target.closest('tr');
      const i = Number(tr.dataset.i);
      const k = e.target.dataset.k;
      draft.items[i][k] = k === 'qty' || k === 'price' ? (Number(e.target.value) || 0) : e.target.value;
      tr.querySelector('[data-cell="total"]').textContent = (draft.items[i].qty * draft.items[i].price).toFixed(2);
      calc(root);
    });
  });
  body.querySelectorAll('[data-k="del"]').forEach(btn => {
    btn.addEventListener('click', e => {
      draft.items.splice(Number(e.target.closest('tr').dataset.i), 1);
      if (!draft.items.length) draft.items.push({ name: '', qty: 1, price: 0 });
      drawItems(root);
      calc(root);
    });
  });
}

function calc(root) {
  const items = draft.items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.price || 0), 0);
  const delivery = Number(draft.delivery || 0);
  const disc = Number(draft.discount || 0);
  const total = Math.max(items + delivery - disc, 0);
  draft._items = items; draft._total = total;
  root.querySelector('#tItems').textContent = items.toFixed(2);
  root.querySelector('#tDelivery').textContent = delivery.toFixed(2);
  root.querySelector('#tDisc').textContent = disc.toFixed(2);
  root.querySelector('#tTotal').textContent = total.toFixed(2);
}

function updateHints(root) {
  const box = root.querySelector('#invHints');
  const data = db.get();
  const hints = [];
  if (draft.customerType === CS.MONTHLY) {
    hints.push('فاتورة <b>شهرية</b>: تتحسب على العميل وتُصفّى بإجمالي آخر الشهر.');
  }
  if (draft.customerType === CS.CREDIT) {
    const existing = data.creditCustomers.find(c => c.phone === draft.phone);
    if (existing) {
      const bal = data.orders.filter(o => o.customerType === CS.CREDIT && o.customerId === existing.id && o.status !== 'ملغي')
        .reduce((s, o) => s + o.total, 0);
      const paid = data.settlements.filter(s => s.kind === 'credit' && s.customerId === existing.id).reduce((s, x) => s + x.amount, 0);
      hints.push(`عميل آجل معروف: <b>${esc(existing.name)}</b> — رصيده الحالي ${(bal - paid).toFixed(2)} ج.م`);
    } else if (draft.phone) {
      hints.push('سيُضاف هذا العميل تلقائيًا لقائمة <b>العملاء الآجل</b>.');
    }
  }
  if (draft.payment === 'آجل') hints.push('طريقة الدفع آجل — مايتحصلش النقدية دلوقتي.');
  if (!draft.employeeId) hints.push('لم تُحدد مندوب التوصيل.');
  box.innerHTML = hints.length ? hints.map(h => `<div class="hint-item">${h}</div>`).join('') : '<p class="muted small">لا توجد تنبيهات</p>';
}

function collect(root) {
  const err = root.querySelector('#invErr');
  draft.date = root.querySelector('#f-date').value;
  draft.customerName = root.querySelector('#f-name').value.trim();
  draft.phone = root.querySelector('#f-phone').value.trim();
  draft.address = root.querySelector('#f-addr').value.trim();
  draft.customerType = root.querySelector('#f-type').value;
  draft.payment = root.querySelector('#f-pay').value;
  draft.employeeId = root.querySelector('#f-driver').value;
  draft.delivery = Number(root.querySelector('#f-delivery').value) || 0;
  draft.discount = Number(root.querySelector('#f-discount').value) || 0;
  draft.notes = root.querySelector('#f-notes').value.trim();
  draft.items = draft.items.filter(i => i.name.trim());

  if (!draft.customerName || !draft.phone || !draft.address) { err.textContent = 'أدخل اسم العميل والهاتف والعنوان.'; return null; }
  if (!draft.items.length) { err.textContent = 'أضف صنفًا واحدًا على الأقل.'; return null; }
  if (!draft.date) { err.textContent = 'حدد تاريخ الفاتورة.'; return null; }
  err.textContent = '';

  const itemsTotal = draft.items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.price || 0), 0);
  draft._total = Math.max(itemsTotal + Number(draft.delivery || 0) - Number(draft.discount || 0), 0);
  return draft;
}

function save(root, after) {
  const snap = structuredClone(draft);
  const d = collect(root);
  if (!d) return;

  const data = db.get();
  let customerId = d.customerType === CS.NORMAL ? '' : null;

  if (d.customerType === CS.CREDIT) {
    let c = data.creditCustomers.find(x => x.phone === d.phone);
    if (!c) {
      c = { id: uid('crd'), name: d.customerName, phone: d.phone, address: d.address, notes: '', createdAt: Date.now(), active: true };
      db.update(x => x.creditCustomers.push(c));
    }
    customerId = c.id;
  } else if (d.customerType === CS.MONTHLY) {
    let c = data.monthlyCustomers.find(x => x.phone === d.phone);
    if (!c) {
      c = { id: uid('mth'), name: d.customerName, phone: d.phone, address: d.address, notes: '', createdAt: Date.now(), active: true };
      db.update(x => x.monthlyCustomers.push(c));
    }
    customerId = c.id;
  }

  const total = Math.max(d._total || 0, 0);
  const order = {
    id: editId || uid('ord'),
    no: editId ? (data.orders.find(o => o.id === editId)?.no ?? data.nextInvoice) : data.nextInvoice,
    date: new Date(d.date).getTime(),
    customerName: d.customerName,
    phone: d.phone,
    address: d.address,
    customerType: d.customerType,
    customerId: customerId || '',
    employeeId: d.employeeId || '',
    items: d.items.map(i => ({ name: i.name, qty: Number(i.qty) || 0, price: Number(i.price) || 0, total: (Number(i.qty) || 0) * (Number(i.price) || 0) })),
    delivery: d.delivery,
    discount: d.discount,
    total,
    payment: d.payment,
    status: d.status,
    notes: d.notes,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  db.update(x => {
    const idx = x.orders.findIndex(o => o.id === order.id);
    if (idx >= 0) x.orders[idx] = order;
    else { x.orders.push(order); x.nextInvoice++; }
    x.undo = { order: structuredClone(order), at: Date.now() };
  });

  editId = null;
  draft = blankDraft();
  render();
  mount(root);
  toast(after === 'print' ? 'تم الحفظ والطباعة' : after === 'wa' ? 'تم الحفظ' : 'تم حفظ الفاتورة #' + order.no, 'ok');

  if (after === 'print') printHTML(buildReceipt(order));
  if (after === 'wa') sendWa(order);
}

export function sendWa(order) {
  const data = db.get();
  const to = order.phone.replace(/\D/g, '');
  const items = order.items.map(i => `• ${i.name} × ${i.qty} = ${i.total.toFixed(2)} ج.م`).join('\n');
  const msg = [
    `مرحباً ${order.customerName} 👋`,
    '',
    'تفاصيل طلبك:',
    `📋 رقم الفاتورة: #${order.no}`,
    `📅 التاريخ: ${new Date(order.date).toLocaleString('ar-EG')}`,
    `🚚 المندوب: ${driverName(order.employeeId)}`,
    '',
    items,
    order.delivery > 0 ? `🚚 دليفري: ${order.delivery.toFixed(2)} ج.م` : '',
    order.discount > 0 ? `🏷️ خصم: ${order.discount.toFixed(2)} ج.م` : '',
    '',
    `💰 الإجمالي: ${order.total.toFixed(2)} ${data.settings.currency}`,
    `💳 الدفع: ${order.payment}`,
    `📌 الحالة: ${order.status}`,
    '',
    `${data.settings.businessName}`
  ].filter(Boolean).join('\n');
  window.open(`https://wa.me/${to}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
}

export function buildReceipt(o) {
  const s = db.get().settings;
  const rows = o.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${i.price.toFixed(0)}</td><td>${i.total.toFixed(0)}</td></tr>`).join('');
  const del = Number(o.delivery || 0) > 0
    ? `<tr><td>دليفري</td><td>1</td><td>${o.delivery}</td><td>${o.delivery}</td></tr>` : '';
  const disc = Number(o.discount || 0) > 0
    ? `<tr><td>خصم</td><td>—</td><td>${o.discount}</td><td>-${o.discount}</td></tr>` : '';
  return `
    <div class="brand">${esc(s.businessName)}</div>
    <div class="sub">${esc(s.address || '')} ${s.phone ? ' · ' + esc(s.phone) : ''}</div>
    <div class="div"></div>
    <div class="meta"><span>التاريخ</span><span>${new Date(o.date).toLocaleString('ar-EG')}</span></div>
    <div class="meta"><span>رقم الفاتورة</span><span>#${o.no}</span></div>
    <div class="meta"><span>العميل</span><span>${esc(o.payment)}</span></div>
    <div class="div"></div>
    <div class="info"><span>الاسم</span><span>${esc(o.customerName)}</span></div>
    <div class="info"><span>الهاتف</span><span>${esc(o.phone)}</span></div>
    <div class="info"><span>المندوب</span><span>${esc(driverName(o.employeeId))}</span></div>
    <div class="addr">${esc(o.address)}</div>
    <div class="div"></div>
    <table><thead><tr><th>الصنف</th><th>كم</th><th>السعر</th><th>الإجمالي</th></tr></thead>
    <tbody>${rows}${del}${disc}</tbody></table>
    <div class="grand"><span>الإجمالي</span><span>${o.total.toFixed(2)} ${esc(s.currency)}</span></div>
    <div class="info"><span>الحالة</span><span>${esc(o.status)}</span></div>
    ${o.notes ? `<div class="addr">ملاحظات: ${esc(o.notes)}</div>` : ''}
    <div class="thanks">شكراً لتعاملكم معنا</div>`;
}

export function loadOrder(id) {
  const o = db.get().orders.find(x => x.id === id);
  if (!o) return;
  editId = id;
  draft = {
    date: dtLocal(o.date),
    customerName: o.customerName,
    phone: o.phone,
    address: o.address,
    customerType: o.customerType,
    employeeId: o.employeeId,
    delivery: o.delivery,
    discount: o.discount,
    payment: o.payment,
    notes: o.notes,
    status: o.status,
    items: o.items.length ? structuredClone(o.items) : [{ name: '', qty: 1, price: 0 }]
  };
}

export default { render, mount, loadOrder, buildReceipt, sendWa };

export { render, mount };
