import { db, uid } from '../db.js';
import { esc, plain, toast, modal, confirmDialog, ICONS } from '../utils.js';

function render() {
  const data = db.get();
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <h3>التصنيفات</h3>
          <span class="muted">${data.categories.length} تصنيف · تُستخدم لتنظيم الكاشير والتقارير</span>
        </div>
        <button class="btn btn-primary" id="btnNew">${ICONS.plus} تصنيف جديد</button>
      </div>

      <div class="cat-grid">
        ${data.categories.map(c => {
          const count = data.products.filter(p => p.categoryId === c.id).length;
          return `
            <div class="cat-card" data-id="${c.id}">
              <span class="cat-color" style="background:${c.color};box-shadow:0 0 18px ${c.color}"></span>
              <div class="cat-meta">
                <strong>${esc(c.name)}</strong>
                <span class="muted">${count} منتج</span>
              </div>
              <div class="cat-acts">
                <button class="icon-btn" data-edit="${c.id}">${ICONS.edit}</button>
                <button class="icon-btn danger" data-del="${c.id}" ${count ? 'disabled title="يحتوي منتجات"' : ''}>${ICONS.trash}</button>
              </div>
            </div>`;
        }).join('') || '<p class="empty">لا توجد تصنيفات</p>'}
      </div>
    </div>`;
}

function mount(root) {
  root.querySelector('#btnNew').addEventListener('click', () => openForm(root));

  root.querySelector('.cat-grid').addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-del]');
    if (editBtn) openForm(root, editBtn.dataset.edit);
    if (delBtn) {
      const c = db.get().categories.find(x => x.id === delBtn.dataset.id);
      if (await confirmDialog(`حذف تصنيف "${c.name}"؟`, { okText: 'حذف', danger: true })) {
        db.update(d => { d.categories = d.categories.filter(x => x.id !== c.id); });
        toast('تم حذف التصنيف');
        rerender(root);
      }
    }
  });
}

function rerender(root) {
  const panel = root.querySelector('.page');
  const holder = document.createElement('div');
  holder.innerHTML = render();
  panel.replaceWith(holder.firstElementChild);
  mount(root);
}

function openForm(root, id) {
  const data = db.get();
  const c = id ? data.categories.find(x => x.id === id) : null;
  const colors = ['#a855f7', '#e879f9', '#38bdf8', '#34d399', '#fbbf24', '#fb7185'];
  const m = modal({
    title: c ? 'تعديل تصنيف' : 'تصنيف جديد',
    body: `
      <form id="catForm" class="form-grid">
        <div class="field span2">
          <input id="cName" placeholder=" " value="${esc(c?.name || '')}" required>
          <label for="cName">اسم التصنيف</label>
        </div>
        <div class="span2">
          <span class="lbl">اللون</span>
          <div class="color-row" id="colorRow">
            ${colors.map(col => `<button type="button" class="swatch ${(c?.color || colors[0]) === col ? 'active' : ''}" data-c="${col}" style="background:${col}"></button>`).join('')}
          </div>
        </div>
        <p class="gate-error span2" id="catErr" role="alert"></p>
      </form>`,
    footer: `
      <button class="btn btn-outline" data-close>إلغاء</button>
      <button class="btn btn-primary" id="cSave">حفظ</button>`
  });

  let color = c?.color || colors[0];
  m.root.querySelector('#colorRow').addEventListener('click', e => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    m.root.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s === b));
    color = b.dataset.c;
  });

  m.root.querySelector('#cSave').addEventListener('click', () => {
    const name = m.root.querySelector('#cName').value.trim();
    if (!name) {
      m.root.querySelector('#catErr').textContent = 'أدخل اسم التصنيف.';
      return;
    }
    db.update(d => {
      if (c) Object.assign(d.categories.find(x => x.id === c.id), { name, color });
      else d.categories.push({ id: uid('cat'), name, color });
    });
    m.close();
    toast(c ? 'تم تحديث التصنيف' : 'تمت إضافة التصنيف', 'ok');
    rerender(root);
  });
}

export default { render, mount };
