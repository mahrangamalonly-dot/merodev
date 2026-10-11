import { db, uid } from '../db.js';
import { esc, money, num, dmy, printHTML, toast, modal, confirmDialog, ICONS } from '../utils.js';
import { employeeStats, monthKey, monthLabel, monthRange, driverName } from '../shared.js';

let selected = null;

function render() {
  const data = db.get();
  const month = monthKey(Date.now());
  const list = data.employees.map(e => ({ e, ...employeeStats(e.id, month) }));
  const emp = selected ? data.employees.find(e => e.id === selected) : null;

  return `
    <div class="page">
      <div class="page-head">
        <div><h3>الموظفين والمناديب</h3><span class="muted">${list.length} موظف · ${monthLabel(month)}</span></div>
        <div class="head-actions">
          <button class="btn btn-outline btn-sm" id="btnPrint">طباعة ملخص المناديب</button>
          <button class="btn btn-primary btn-sm" id="btnNew">+ موظف</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>الاسم</th><th>الوظيفة</th><th>الهاتف</th><th>طلبات الشهر</th>
            <th>تم التوصيل</th><th>أرباح دليفري</th><th>سلف</th><th>خصومات</th><th>المستحق</th><th></th>
          </tr></thead>
          <tbody>${list.map(r => `
            <tr class="${selected === r.e.id ? 'sel' : ''}">
              <td><strong>${esc(r.e.name)}</strong></td>
              <td>${esc(r.e.role || 'مندوب توصيل')}</td>
              <td class="mono">${esc(r.e.phone || '—')}</td>
              <td class="mono">${r.orders}</td>
              <td class="mono">${r.delivered}</td>
              <td class="mono">${r.fees.toFixed(2)}</td>
              <td class="mono neg">${r.advances.toFixed(2)}</td>
              <td class="mono neg">${r.deductions.toFixed(2)}</td>
              <td class="mono strong ${r.due >= 0 ? 'ok' : 'neg'}">${r.due.toFixed(2)}</td>
              <td class="row-actions">
                <button class="btn btn-outline btn-sm" data-act="select" data-id="${r.e.id}">${selected === r.e.id ? 'محدد' : 'اختيار'}</button>
                <button class="icon-btn" data-act="edit" data-id="${r.e.id}">${ICONS.edit}</button>
                <button class="icon-btn danger" data-act="del" data-id="${r.e.id}">${ICONS.trash}</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="10" class="empty">لا يوجد موظفين</td></tr>'}</tbody>
        </table>
      </div>

      ${emp ? `
        <div class="grid-2" style="margin-top:1rem">
          <div class="panel">
            <div class="panel-head"><h4>سلف ${esc(emp.name)}</h4>
              <button class="btn btn-outline btn-sm" id="btnAdv">+ سلفة</button></div>
            <div class="table-wrap thin">
              <table class="table">
                <thead><tr><th>التاريخ</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr></thead>
                <tbody>${data.advances.filter(a => a.employeeId === emp.id).sort((a, b) => b.date - a.date).map(a => `
                  <tr><td>${dmy(a.date)}</td><td class="mono neg">${Number(a.amount).toFixed(2)}</td><td>${esc(a.notes || '—')}</td>
                  <td><button class="icon-btn danger" data-act="deladv" data-id="${a.id}">×</button></td></tr>`).join('')
                  || '<tr><td colspan="4" class="empty">لا توجد سلف</td></tr>'}</tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head"><h4>خصومات ${esc(emp.name)}</h4>
              <button class="btn btn-outline btn-sm" id="btnDed">+ خصم</button></div>
            <div class="table-wrap thin">
              <table class="table">
                <thead><tr><th>التاريخ</th><th>المبلغ</th><th>السبب</th><th></th></tr></thead>
                <tbody>${data.deductions.filter(x => x.employeeId === emp.id).sort((a, b) => b.date - a.date).map(x => `
                  <tr><td>${dmy(x.date)}</td><td class="mono neg">${Number(x.amount).toFixed(2)}</td><td>${esc(x.reason || '—')}</td>
                  <td><button class="icon-btn danger" data-act="delded" data-id="${x.id}">×</button></td></tr>`).join('')
                  || '<tr><td colspan="4" class="empty">لا توجد خصومات</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="panel" style="margin-top:1rem">
          <div class="panel-head"><h4>الحضور اليوم</h4></div>
          <div class="att-row">
            ${data.employees.map(e => {
              const today = new Date().toDateString();
              const rec = data.attendance.find(a => a.employeeId === e.id && new Date(a.date).toDateString() === today);
              return `<div class="att-card ${rec ? 'on' : ''}">
                <span class="nm">${esc(e.name)}</span>
                <span class="st">${rec ? 'حاضر' : 'لم يسجل'}</span>
                <button class="btn btn-outline btn-sm" data-act="att" data-id="${e.id}">${rec ? 'إلغاء' : 'تسجيل حضور'}</button>
              </div>`;
            }).join('')}
          </div>
        </div>
      ` : '<p class="muted" style="margin-top:1rem">اختر موظفًا لإدارة سلفه وخصوماته وحضوره.</p>'}
    </div>`;
}

function mount(root) {
  bind(root);
}

function bind(root) {
  const data = db.get();

  root.querySelector('#btnNew').addEventListener('click', () => openForm(root));
  root.querySelector('#btnPrint').addEventListener('click', () => printSummary(root));

  root.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;

      if (act === 'select') { selected = selected === id ? null : id; rerender(root); }
      if (act === 'edit') openForm(root, data.employees.find(e => e.id === id));
      if (act === 'del') {
        const e = data.employees.find(x => x.id === id);
        if (!(await confirmDialog(`حذف ${e.name}؟`, 'حذف', true))) return;
        db.update(d => { d.employees = d.employees.filter(x => x.id !== id); });
        if (selected === id) selected = null;
        toast('تم الحذف');
        rerender(root);
      }
      if (act === 'deladv') {
        db.update(d => { d.advances = d.advances.filter(a => a.id !== id); });
        toast('تم حذف السلفة');
        rerender(root);
      }
      if (act === 'delded') {
        db.update(d => { d.deductions = d.deductions.filter(x => x.id !== id); });
        toast('تم حذف الخصم');
        rerender(root);
      }
      if (act === 'att') {
        const empId = id;
        const today = new Date().toDateString();
        const existing = db.get().attendance.find(a => a.employeeId === empId && new Date(a.date).toDateString() === today);
        db.update(d => {
          if (existing) d.attendance = d.attendance.filter(a => a.id !== existing.id);
          else d.attendance.push({ id: uid('att'), employeeId: empId, date: Date.now(), type: 'حضور' });
        });
        rerender(root);
      }
    });
  });

  root.querySelector('#btnAdv')?.addEventListener('click', () => openAmount(root, 'advance'));
  root.querySelector('#btnDed')?.addEventListener('click', () => openAmount(root, 'deduction'));
}

function rerender(root) {
  const host = document.querySelector('#view');
  const prev = selected;
  host.innerHTML = render();
  selected = prev;
  bind(root);
}

function openForm(root, emp) {
  const m = modal({
    title: emp ? 'تعديل موظف' : 'موظف جديد',
    body: `
      <form id="ef" class="form-grid">
        <div class="field span2"><input id="n" placeholder=" " value="${esc(emp?.name || '')}" required><label for="n">الاسم</label></div>
        <div class="field"><input id="p" placeholder=" " dir="ltr" value="${esc(emp?.phone || '')}"><label for="p">الهاتف</label></div>
        <div class="field">
          <select id="r" class="select">
            ${['مندوب توصيل', 'كاشير', 'مدير'].map(r => `<option ${emp?.role === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
          <label class="sel-label">الوظيفة</label>
        </div>
      </form>`,
    footer: `<button class="btn btn-outline" data-close>إلغاء</button><button class="btn btn-primary" id="eSave">حفظ</button>`
  });
  m.root.querySelector('#eSave').addEventListener('click', () => {
    const name = m.root.querySelector('#n').value.trim();
    if (!name) { toast('أدخل الاسم', 'err'); return; }
    db.update(d => {
      if (emp) Object.assign(d.employees.find(e => e.id === emp.id), {
        name, phone: m.root.querySelector('#p').value.trim(), role: m.root.querySelector('#r').value
      });
      else d.employees.push({
        id: uid('emp'), name, phone: m.root.querySelector('#p').value.trim(),
        role: m.root.querySelector('#r').value, active: true, joinedAt: Date.now()
      });
    });
    m.close();
    toast(emp ? 'تم التحديث' : 'تمت الإضافة', 'ok');
    rerender(root);
  });
}

function openAmount(root, kind) {
  const emp = db.get().employees.find(e => e.id === selected);
  if (!emp) return;
  const m = modal({
    title: kind === 'advance' ? `سلفة — ${emp.name}` : `خصم — ${emp.name}`,
    body: `
      <form id="af" class="form-grid">
        <div class="field"><input id="amt" type="number" min="0" step="0.25" placeholder=" " dir="ltr" required><label for="amt">المبلغ</label></div>
        <div class="field"><input id="nte" placeholder=" "><label for="nte">${kind === 'advance' ? 'ملاحظة' : 'السبب'}</label></div>
      </form>`,
    footer: `<button class="btn btn-outline" data-close>إلغاء</button><button class="btn btn-primary" id="aSave">حفظ</button>`
  });
  m.root.querySelector('#aSave').addEventListener('click', () => {
    const amount = Number(m.root.querySelector('#amt').value) || 0;
    if (amount <= 0) { toast('أدخل مبلغًا', 'err'); return; }
    db.update(d => {
      if (kind === 'advance') d.advances.push({ id: uid('adv'), employeeId: emp.id, amount, date: Date.now(), notes: m.root.querySelector('#nte').value.trim() });
      else d.deductions.push({ id: uid('ded'), employeeId: emp.id, amount, date: Date.now(), reason: m.root.querySelector('#nte').value.trim() });
    });
    m.close();
    toast(kind === 'advance' ? 'تم تسجيل السلفة' : 'تم تسجيل الخصم', 'ok');
    rerender(root);
  });
}

function printSummary(root) {
  const data = db.get();
  const month = monthKey(Date.now());
  const list = data.employees.map(e => ({ e, ...employeeStats(e.id, month) }));
  printHTML(`
    <h3>${esc(data.settings.businessName)}</h3>
    <div class="center">ملخص المناديب — ${monthLabel(month)}</div>
    <div class="div"></div>
    <table><thead><tr><th>المندوب</th><th>طلبات</th><th>تم التوصيل</th><th>دليفري</th><th>سلف</th><th>خصومات</th><th>المستحق</th></tr></thead>
    <tbody>${list.map(r => `<tr><td>${esc(r.e.name)}</td><td>${r.orders}</td><td>${r.delivered}</td><td>${r.fees.toFixed(0)}</td><td>${r.advances.toFixed(0)}</td><td>${r.deductions.toFixed(0)}</td><td>${r.due.toFixed(0)}</td></tr>`).join('')}</tbody></table>
    <div class="grand"><span>إجمالي المستحق</span><span>${list.reduce((s, r) => s + r.due, 0).toFixed(2)} ${esc(data.settings.currency)}</span></div>`, data.settings.paper);
}

export default { render, mount };
