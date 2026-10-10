import { db, session, uid } from '../db.js';
import { esc, toast, modal, confirmDialog, ICONS } from '../utils.js';

const roles = [
  { v: 'admin', l: 'مدير النظام — كل الصلاحيات' },
  { v: 'manager', l: 'مشرف — المنتجات والتقارير' },
  { v: 'cashier', l: 'كاشير — الكاشير فقط' }
];

function render() {
  const data = db.get();
  const me = session.get();
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <h3>المستخدمون</h3>
          <span class="muted">${data.users.length} مستخدم · كل مستخدم له رقم سري خاص</span>
        </div>
        <button class="btn btn-primary" id="btnNew">${ICONS.plus} مستخدم جديد</button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>الاسم</th><th>اسم المستخدم</th><th>الصلاحية</th><th>الحالة</th><th></th></tr>
          </thead>
          <tbody>
            ${data.users.map(u => `
              <tr>
                <td>
                  <span class="avatar sm">${esc(u.name.slice(0, 1))}</span>
                  <strong>${esc(u.name)}</strong>${u.id === me.id ? ' <span class="tag-mini">أنت</span>' : ''}
                </td>
                <td class="mono">${esc(u.username)}</td>
                <td>${roles.find(r => r.v === u.role)?.l.split(' — ')[0] || u.role}</td>
                <td><span class="pill-mini ${u.active ? 'ok' : 'off'}">${u.active ? 'نشط' : 'موقوف'}</span></td>
                <td class="row-actions">
                  <button class="icon-btn" data-edit="${u.id}">${ICONS.edit}</button>
                  <button class="icon-btn danger" data-del="${u.id}" ${u.id === me.id ? 'disabled' : ''}>${ICONS.trash}</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function mount(root) {
  root.querySelector('#btnNew').addEventListener('click', () => openForm(root));

  root.querySelector('.table').addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-del]');
    if (editBtn) openForm(root, editBtn.dataset.edit);
    if (delBtn) {
      const u = db.get().users.find(x => x.id === delBtn.dataset.del);
      if (await confirmDialog(`حذف المستخدم "${u.name}"؟`, { okText: 'حذف', danger: true })) {
        db.update(d => { d.users = d.users.filter(x => x.id !== u.id); });
        toast('تم حذف المستخدم');
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
  const u = id ? db.get().users.find(x => x.id === id) : null;
  const m = modal({
    title: u ? 'تعديل مستخدم' : 'مستخدم جديد',
    body: `
      <form id="userForm" class="form-grid">
        <div class="field span2">
          <input id="uName" placeholder=" " value="${esc(u?.name || '')}" required>
          <label for="uName">الاسم الكامل</label>
        </div>
        <div class="field">
          <input id="uUser" placeholder=" " dir="ltr" value="${esc(u?.username || '')}" required>
          <label for="uUser">اسم المستخدم</label>
        </div>
        <div class="field">
          <input id="uPin" placeholder=" " dir="ltr" maxlength="6" inputmode="numeric" value="${esc(u?.pin || '')}" required>
          <label for="uPin">الرقم السري</label>
        </div>
        <div class="field span2">
          <select id="uRole" class="select">${roles.map(r => `<option value="${r.v}" ${u?.role === r.v ? 'selected' : ''}>${r.l}</option>`).join('')}</select>
          <label class="sel-label">الصلاحية</label>
        </div>
        <label class="check span2">
          <input type="checkbox" id="uActive" ${u ? (u.active ? 'checked' : '') : 'checked'}>
          <span>الحساب نشط</span>
        </label>
        <p class="gate-error span2" id="uErr" role="alert"></p>
      </form>`,
    footer: `
      <button class="btn btn-outline" data-close>إلغاء</button>
      <button class="btn btn-primary" id="uSave">حفظ</button>`
  });

  m.root.querySelector('#uSave').addEventListener('click', () => {
    const name = m.root.querySelector('#uName').value.trim();
    const username = m.root.querySelector('#uUser').value.trim().toLowerCase();
    const pin = m.root.querySelector('#uPin').value.trim();
    const data = db.get();

    if (!name || !username || !/^\d{4,6}$/.test(pin)) {
      m.root.querySelector('#uErr').textContent = 'الاسم واسم المستخدم مطلوبان، والرقم السري من 4 إلى 6 أرقام.';
      return;
    }
    if (data.users.some(x => x.username === username && x.id !== u?.id)) {
      m.root.querySelector('#uErr').textContent = 'اسم المستخدم مستخدم بالفعل.';
      return;
    }

    const payload = {
      name,
      username,
      pin,
      role: m.root.querySelector('#uRole').value,
      active: m.root.querySelector('#uActive').checked
    };
    db.update(d => {
      if (u) Object.assign(d.users.find(x => x.id === u.id), payload);
      else d.users.push({ id: uid('usr'), ...payload });
    });
    m.close();
    toast(u ? 'تم تحديث المستخدم' : 'تمت إضافة المستخدم', 'ok');
    rerender(root);
  });
}

export default { render, mount };
