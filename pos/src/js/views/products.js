import { db, uid } from '../db.js';
import { esc, money, plain, toast, modal, confirmDialog, ICONS } from '../utils.js';

let filter = { q: '', cat: 'all', stock: 'all' };

function render() {
  const data = db.get();
  const q = filter.q.trim().toLowerCase();

  const list = data.products.filter(p => {
    if (filter.cat !== 'all' && p.categoryId !== filter.cat) return false;
    if (filter.stock === 'low' && p.stock > data.settings.lowStock) return false;
    if (filter.stock === 'out' && p.stock > 0) return false;
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q);
  });

  const value = data.products.reduce((s, p) => s + p.stock * p.cost, 0);
  const retail = data.products.reduce((s, p) => s + p.stock * p.price, 0);

  return `
    <div class="page">
      <div class="page-head">
        <div>
          <h3>المنتجات</h3>
          <span class="muted">${data.products.length} منتج · قيمة المخزون ${plain(value)} ${esc(data.settings.currency)}</span>
        </div>
        <div class="page-actions">
          <button class="btn btn-outline" id="btnExport">تصدير CSV</button>
          <button class="btn btn-primary" id="btnNew">${ICONS.plus} منتج جديد</button>
        </div>
      </div>

      <div class="filters">
        <div class="input-wrap grow">
          <span class="input-ico">${ICONS.search}</span>
          <input id="pSearch" value="${esc(filter.q)}" placeholder="ابحث عن منتج أو باركود…">
        </div>
        <select id="fCat" class="select">
          <option value="all">كل التصنيفات</option>
          ${data.categories.map(c => `<option value="${c.id}" ${filter.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
        <select id="fStock" class="select">
          <option value="all" ${filter.stock === 'all' ? 'selected' : ''}>كل الكميات</option>
          <option value="low" ${filter.stock === 'low' ? 'selected' : ''}>مخزون منخفض</option>
          <option value="out" ${filter.stock === 'out' ? 'selected' : ''}>نفد المخزون</option>
        </select>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>المنتج</th><th>التصنيف</th><th>الباركود</th>
              <th>التكلفة</th><th>السعر</th><th>الكمية</th><th>هامش الربح</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(p => {
              const cat = data.categories.find(c => c.id === p.categoryId);
              const margin = p.cost > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : 100;
              return `<tr>
                <td><strong>${esc(p.name)}</strong>${p.active ? '' : ' <span class="tag-mini">موقوف</span>'}</td>
                <td>${cat ? `<span class="cat-dot" style="background:${cat.color}"></span>${esc(cat.name)}` : '—'}</td>
                <td class="mono">${esc(p.barcode || '—')}</td>
                <td class="mono">${plain(p.cost)}</td>
                <td class="mono strong">${plain(p.price)}</td>
                <td><span class="stock ${p.stock === 0 ? 'out' : p.stock <= data.settings.lowStock ? 'low' : ''}">${p.stock} ${esc(p.unit || '')}</span></td>
                <td class="mono">${margin}%</td>
                <td class="row-actions">
                  <button class="icon-btn" data-edit="${p.id}" title="تعديل">${ICONS.edit}</button>
                  <button class="icon-btn danger" data-del="${p.id}" title="حذف">${ICONS.trash}</button>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="8" class="empty">لا توجد منتجات</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

function mount(root) {
  root.querySelector('#pSearch').addEventListener('input', e => {
    filter.q = e.target.value;
    softRender(root);
  });
  root.querySelector('#fCat').addEventListener('change', e => { filter.cat = e.target.value; softRender(root); });
  root.querySelector('#fStock').addEventListener('change', e => { filter.stock = e.target.value; softRender(root); });

  root.querySelector('#btnNew').addEventListener('click', () => openForm(root));
  root.querySelector('#btnExport').addEventListener('click', exportCSV);

  root.querySelector('.table').addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-del]');
    if (editBtn) openForm(root, editBtn.dataset.edit);
    if (delBtn) {
      const p = db.get().products.find(x => x.id === delBtn.dataset.del);
      if (await confirmDialog(`حذف المنتج "${p.name}"؟`, { okText: 'حذف', danger: true })) {
        db.update(d => { d.products = d.products.filter(x => x.id !== p.id); });
        toast('تم حذف المنتج');
        softRender(root);
      }
    }
  });
}

function softRender(root) {
  const focus = document.activeElement?.id;
  const sel = focus ? document.activeElement.selectionStart : null;
  const panel = root.querySelector('.page');
  const holder = document.createElement('div');
  holder.innerHTML = render();
  panel.replaceWith(holder.firstElementChild);
  mount(root);
  if (focus) {
    const el = root.querySelector(`#${focus}`);
    if (el) { el.focus(); if (sel != null && el.setSelectionRange) el.setSelectionRange(sel, sel); }
  }
}

function exportCSV() {
  const data = db.get();
  const rows = [['المنتج', 'التصنيف', 'الباركود', 'التكلفة', 'السعر', 'الكمية']];
  data.products.forEach(p => {
    const c = data.categories.find(x => x.id === p.categoryId);
    rows.push([p.name, c ? c.name : '', p.barcode || '', p.cost, p.price, p.stock]);
  });
  const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'mero-pos-products.csv' });
  a.click();
  URL.revokeObjectURL(url);
  toast('تم تصدير الملف', 'ok');
}

function openForm(root, id) {
  const data = db.get();
  const p = id ? data.products.find(x => x.id === id) : null;
  const m = modal({
    title: p ? 'تعديل منتج' : 'منتج جديد',
    body: `
      <form id="prodForm" class="form-grid">
        <div class="field span2">
          <input id="fName" placeholder=" " value="${esc(p?.name || '')}" required>
          <label for="fName">اسم المنتج</label>
        </div>
        <div class="field">
          <select id="fCat" class="select">
            ${data.categories.map(c => `<option value="${c.id}" ${p?.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
          <label class="sel-label">التصنيف</label>
        </div>
        <div class="field">
          <input id="fBarcode" placeholder=" " dir="ltr" value="${esc(p?.barcode || '')}">
          <label for="fBarcode">الباركود</label>
        </div>
        <div class="field">
          <input id="fPrice" type="number" min="0" step="0.25" placeholder=" " dir="ltr" value="${p?.price ?? ''}" required>
          <label for="fPrice">سعر البيع</label>
        </div>
        <div class="field">
          <input id="fCost" type="number" min="0" step="0.25" placeholder=" " dir="ltr" value="${p?.cost ?? ''}">
          <label for="fCost">سعر التكلفة</label>
        </div>
        <div class="field">
          <input id="fStock" type="number" min="0" step="1" placeholder=" " dir="ltr" value="${p?.stock ?? 0}" required>
          <label for="fStock">الكمية</label>
        </div>
        <div class="field">
          <input id="fUnit" placeholder=" " value="${esc(p?.unit || 'قطعة')}">
          <label for="fUnit">الوحدة</label>
        </div>
        <label class="check span2">
          <input type="checkbox" id="fActive" ${p ? (p.active ? 'checked' : '') : 'checked'}>
          <span>متاح للبيع</span>
        </label>
        <p class="gate-error span2" id="formErr" role="alert"></p>
      </form>`,
    footer: `
      <button class="btn btn-outline" data-close>إلغاء</button>
      <button class="btn btn-primary" id="fSave">حفظ</button>`
  });

  m.root.querySelector('#fSave').addEventListener('click', () => {
    const name = m.root.querySelector('#fName').value.trim();
    const price = Number(m.root.querySelector('#fPrice').value);
    if (!name || !(price >= 0)) {
      m.root.querySelector('#formErr').textContent = 'أدخل اسمًا صحيحًا وسعرًا.';
      return;
    }
    const payload = {
      name,
      categoryId: m.root.querySelector('#fCat').value,
      barcode: m.root.querySelector('#fBarcode').value.trim(),
      price,
      cost: Number(m.root.querySelector('#fCost').value) || 0,
      stock: Number(m.root.querySelector('#fStock').value) || 0,
      unit: m.root.querySelector('#fUnit').value.trim() || 'قطعة',
      active: m.root.querySelector('#fActive').checked
    };
    db.update(d => {
      if (p) Object.assign(d.products.find(x => x.id === p.id), payload);
      else d.products.push({ id: uid('prd'), createdAt: Date.now(), ...payload });
    });
    m.close();
    toast(p ? 'تم تحديث المنتج' : 'تمت إضافة المنتج', 'ok');
    softRender(root);
  });
}

export default { render, mount };
