import { db, session, uid } from '../db.js';
import { esc, money, plain, timeOnly, toast, modal, confirmDialog, printHTML, ICONS } from '../utils.js';

const CAT_ALL = 'all';
const state = { q: '', cat: CAT_ALL, cart: [], discount: 0 };

function visibleProducts(data) {
  const q = state.q.trim().toLowerCase();
  return data.products.filter(p => {
    if (!p.active) return false;
    if (state.cat !== CAT_ALL && p.categoryId !== state.cat) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode || '').includes(q) ||
      String(p.price).includes(q)
    );
  });
}

function render() {
  const data = db.get();
  const cats = data.categories;
  const prods = visibleProducts(data);

  return `
    <div class="pos">
      <section class="pos-left">
        <div class="pos-tools">
          <div class="input-wrap grow">
            <span class="input-ico">${ICONS.search}</span>
            <input id="posSearch" value="${esc(state.q)}" placeholder="ابحث بالاسم أو الباركود… (F2)" autocomplete="off">
          </div>
          <button class="btn btn-outline" id="btnHold" title="حفظ السلة الحالية (F4)">حفظ السلة</button>
        </div>

        <div class="cat-tabs" id="catTabs">
          <button class="ctab ${state.cat === CAT_ALL ? 'active' : ''}" data-cat="${CAT_ALL}">الكل</button>
          ${cats.map(c => `
            <button class="ctab ${state.cat === c.id ? 'active' : ''}" data-cat="${c.id}">
              <i style="background:${c.color}"></i>${esc(c.name)}
            </button>`).join('')}
        </div>

        <div class="prod-grid" id="prodGrid">
          ${prods.length ? prods.map(p => `
            <button class="prod" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
              <span class="prod-name">${esc(p.name)}</span>
              <span class="prod-price">${plain(p.price)}</span>
              <span class="prod-stock ${p.stock <= data.settings.lowStock ? 'low' : ''}">${p.stock} ${esc(p.unit || '')}</span>
            </button>`).join('') : `<p class="empty">لا توجد منتجات مطابقة</p>`}
        </div>
      </section>

      <aside class="pos-right">
        <div class="cart-head">
          <h3>الفاتورة الحالية</h3>
          ${data.held.length ? `<button class="btn btn-ghost btn-sm" id="btnHeld">المحفوظة (${data.held.length})</button>` : ''}
        </div>

        <div class="cart-list" id="cartList">
          ${state.cart.length ? state.cart.map(it => `
            <div class="cart-row" data-id="${it.id}">
              <div class="ci-main">
                <span class="ci-name">${esc(it.name)}</span>
                <span class="ci-price">${plain(it.price)} × ${it.qty}</span>
              </div>
              <div class="ci-actions">
                <button class="qbtn" data-act="dec" aria-label="إنقاص">−</button>
                <span class="qval">${it.qty}</span>
                <button class="qbtn" data-act="inc" aria-label="زيادة">+</button>
                <span class="ci-total">${plain(it.price * it.qty)}</span>
                <button class="qbtn del" data-act="del" aria-label="حذف">×</button>
              </div>
            </div>`).join('') : `<p class="empty">أضف منتجات لبدء الفاتورة</p>`}
        </div>

        <div class="cart-foot">
          <div class="disc-row">
            <label for="discount">خصم</label>
            <div class="disc-inputs">
              <input id="discount" type="number" min="0" max="100" step="0.5" value="${state.discount}">
              <span>%</span>
            </div>
          </div>
          <div class="tot-row"><span>المجموع الفرعي</span><strong id="tSub">${plain(totals().sub)}</strong></div>
          <div class="tot-row"><span>الخصم</span><strong id="tDisc">-${plain(totals().disc)}</strong></div>
          <div class="tot-row"><span>الضريبة (${data.settings.taxRate}%)</span><strong id="tTax">${plain(totals().tax)}</strong></div>
          <div class="tot-row big"><span>الإجمالي</span><strong id="tTotal">${plain(totals().total)}</strong></div>
          <div class="cart-btns">
            <button class="btn btn-danger" id="btnClear" ${state.cart.length ? '' : 'disabled'}>إلغاء الفاتورة</button>
            <button class="btn btn-primary btn-lg" id="btnPay" ${state.cart.length ? '' : 'disabled'}>
              ${ICONS.print} دفع وطباعة <kbd>F9</kbd>
            </button>
          </div>
        </div>
      </aside>
    </div>`;
}

function totals() {
  const data = db.get();
  const sub = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const disc = (sub * Math.min(Math.max(state.discount, 0), 100)) / 100;
  const taxable = sub - disc;
  const tax = (taxable * (data.settings.taxRate || 0)) / 100;
  return { sub, disc, tax, total: taxable + tax };
}

function mount(root) {
  const data = db.get();
  const input = root.querySelector('#posSearch');

  input?.focus();
  input?.addEventListener('input', e => { state.q = e.target.value; repaintGrid(root); });
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const list = visibleProducts(db.get());
      if (list.length === 1) addToCart(root, list[0]);
      else if (list.length) addToCart(root, list[0]);
    }
  });

  root.querySelector('#catTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.ctab');
    if (!btn) return;
    state.cat = btn.dataset.cat;
    root.querySelectorAll('.ctab').forEach(b => b.classList.toggle('active', b === btn));
    repaintGrid(root);
  });

  root.querySelector('#prodGrid')?.addEventListener('click', e => {
    const btn = e.target.closest('.prod');
    if (!btn) return;
    const p = db.get().products.find(x => x.id === btn.dataset.id);
    if (p) addToCart(root, p);
  });

  const disc = root.querySelector('#discount');
  disc?.addEventListener('input', e => {
    state.discount = Number(e.target.value) || 0;
    repaintTotals(root);
  });

  root.querySelector('#cartList')?.addEventListener('click', e => {
    const btn = e.target.closest('.qbtn');
    if (!btn) return;
    const row = btn.closest('.cart-row');
    const item = state.cart.find(i => i.id === row.dataset.id);
    if (!item) return;
    const act = btn.dataset.act;
    if (act === 'inc') item.qty++;
    if (act === 'dec') item.qty--;
    if (act === 'del' || item.qty <= 0) state.cart = state.cart.filter(i => i.id !== item.id);
    repaintCart(root);
    repaintTotals(root);
  });

  root.querySelector('#btnClear')?.addEventListener('click', async () => {
    if (!state.cart.length) return;
    if (await confirmDialog('إلغاء الفاتورة الحالية؟', { okText: 'إلغاء الفاتورة', danger: true })) {
      state.cart = [];
      state.discount = 0;
      repaintAll(root);
      toast('تم إلغاء الفاتورة');
    }
  });

  root.querySelector('#btnHold')?.addEventListener('click', () => {
    if (!state.cart.length) return toast('السلة فارغة', 'err');
    db.update(d => {
      d.held.push({ id: uid('hold'), ts: Date.now(), items: structuredClone(state.cart), discount: state.discount });
    });
    state.cart = [];
    state.discount = 0;
    repaintAll(root);
    toast('تم حفظ السلة');
  });

  root.querySelector('#btnHeld')?.addEventListener('click', () => openHeld(root));

  root.querySelector('#btnPay')?.addEventListener('click', () => openPay(root));

  const onKey = e => {
    if (e.key === 'F2') { e.preventDefault(); input?.focus(); }
    if (e.key === 'F4') { e.preventDefault(); root.querySelector('#btnHold')?.click(); }
    if (e.key === 'F9') { e.preventDefault(); root.querySelector('#btnPay')?.click(); }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

function addToCart(root, p) {
  if (p.stock <= 0) return toast('الكمية غير متوفرة في المخزون', 'err');
  const found = state.cart.find(i => i.id === p.id);
  if (found) {
    if (found.qty + 1 > p.stock) return toast('لا توجد كميات كافية', 'err');
    found.qty++;
  } else {
    state.cart.push({ id: p.id, name: p.name, price: p.price, qty: 1 });
  }
  repaintCart(root);
  repaintTotals(root);
}

function repaintGrid(root) {
  const prods = visibleProducts(db.get());
  const grid = root.querySelector('#prodGrid');
  if (!grid) return;
  grid.innerHTML = prods.length ? prods.map(p => `
    <button class="prod" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
      <span class="prod-name">${esc(p.name)}</span>
      <span class="prod-price">${plain(p.price)}</span>
      <span class="prod-stock ${p.stock <= db.get().settings.lowStock ? 'low' : ''}">${p.stock} ${esc(p.unit || '')}</span>
    </button>`).join('') : `<p class="empty">لا توجد منتجات مطابقة</p>`;
}

function repaintCart(root) {
  const list = root.querySelector('#cartList');
  const data = db.get();
  if (!list) return;
  list.innerHTML = state.cart.length ? state.cart.map(it => `
    <div class="cart-row" data-id="${it.id}">
      <div class="ci-main">
        <span class="ci-name">${esc(it.name)}</span>
        <span class="ci-price">${plain(it.price)} × ${it.qty}</span>
      </div>
      <div class="ci-actions">
        <button class="qbtn" data-act="dec" aria-label="إنقاص">−</button>
        <span class="qval">${it.qty}</span>
        <button class="qbtn" data-act="inc" aria-label="زيادة">+</button>
        <span class="ci-total">${plain(it.price * it.qty)}</span>
        <button class="qbtn del" data-act="del" aria-label="حذف">×</button>
      </div>
    </div>`).join('') : `<p class="empty">أضف منتجات لبدء الفاتورة</p>`;

  const head = root.querySelector('.cart-head');
  if (head) {
    const held = data.held.length
      ? `<button class="btn btn-ghost btn-sm" id="btnHeld">المحفوظة (${data.held.length})</button>` : '';
    head.innerHTML = `<h3>الفاتورة الحالية</h3>${held}`;
    head.querySelector('#btnHeld')?.addEventListener('click', () => openHeld(root));
  }
  root.querySelector('#btnClear')?.toggleAttribute('disabled', !state.cart.length);
  root.querySelector('#btnPay')?.toggleAttribute('disabled', !state.cart.length);
}

function repaintTotals(root) {
  const t = totals();
  const set = (sel, val) => { const el = root.querySelector(sel); if (el) el.textContent = val; };
  set('#tSub', plain(t.sub));
  set('#tDisc', `-${plain(t.disc)}`);
  set('#tTax', plain(t.tax));
  set('#tTotal', plain(t.total));
}

function repaintAll(root) {
  repaintGrid(root);
  repaintCart(root);
  repaintTotals(root);
  const disc = root.querySelector('#discount');
  if (disc) disc.value = state.discount;
}

function openPay(root) {
  if (!state.cart.length) return;
  const t = totals();
  const data = db.get();
  const m = modal({
    title: 'إتمام الدفع',
    body: `
      <div class="pay-total">
        <span>المطلوب</span>
        <strong>${plain(t.total)} <small>${esc(data.settings.currency)}</small></strong>
      </div>
      <div class="pay-methods" id="payMethods">
        <button class="pm active" data-m="cash">نقدي</button>
        <button class="pm" data-m="card">بطاقة</button>
        <button class="pm" data-m="transfer">تحويل</button>
      </div>
      <div class="field" id="cashField">
        <input id="cashIn" type="number" min="0" step="0.25" placeholder=" " dir="ltr">
        <label for="cashIn">المبلغ المستلم</label>
      </div>
      <div class="tot-row change"><span>الباقي</span><strong id="changeOut">0.00</strong></div>
      <p class="gate-error" id="payErr" role="alert"></p>`,
    footer: `
      <button class="btn btn-outline" data-close>إلغاء</button>
      <button class="btn btn-primary btn-lg" id="payConfirm">تأكيد الدفع وطباعة</button>`
  });

  let method = 'cash';
  const cash = m.root.querySelector('#cashIn');
  const change = m.root.querySelector('#changeOut');
  const err = m.root.querySelector('#payErr');

  m.root.querySelector('#payMethods').addEventListener('click', e => {
    const b = e.target.closest('.pm');
    if (!b) return;
    m.root.querySelectorAll('.pm').forEach(x => x.classList.toggle('active', x === b));
    method = b.dataset.m;
    m.root.querySelector('#cashField').style.display = method === 'cash' ? '' : 'none';
    err.textContent = '';
  });

  cash.addEventListener('input', () => {
    const back = (Number(cash.value) || 0) - t.total;
    change.textContent = plain(back > 0 ? back : 0);
  });

  m.root.querySelector('#payConfirm').addEventListener('click', () => {
    if (method === 'cash' && (Number(cash.value) || 0) < t.total) {
      err.textContent = 'المبلغ المستلم أقل من الإجمالي.';
      return;
    }
    completeSale(method, Number(cash.value) || 0);
    m.close();
    repaintAll(root);
  });
}

function completeSale(method, cashIn) {
  const user = session.get();
  const data = db.get();
  const t = totals();
  const invoiceNo = ++data.counter;

  const sale = {
    id: uid('sale'),
    invoiceNo,
    ts: Date.now(),
    userId: user.id,
    userName: user.name,
    items: structuredClone(state.cart),
    subtotal: t.sub,
    discount: t.disc,
    tax: t.tax,
    total: t.total,
    method,
    cashIn: method === 'cash' ? cashIn : t.total,
    change: method === 'cash' ? Math.max(cashIn - t.total, 0) : 0
  };

  db.update(d => {
    d.counter = invoiceNo;
    d.sales.push(sale);
    sale.items.forEach(it => {
      const p = d.products.find(x => x.id === it.id);
      if (p) {
        sale.costTotal = (sale.costTotal || 0) + (p.cost || 0) * it.qty;
        p.stock = Math.max(p.stock - it.qty, 0);
      }
    });
  });

  state.cart = [];
  state.discount = 0;
  showReceipt(sale);
  toast(`تم البيع · فاتورة #${invoiceNo}`, 'ok');
}

function showReceipt(sale) {
  const data = db.get();
  const s = data.settings;
  const m = modal({
    title: `فاتورة #${sale.invoiceNo}`,
    size: 'sm',
    body: `
      <div class="receipt" id="receiptBody">
        <h2>${esc(s.storeName)}</h2>
        <div class="c">${esc(s.address || '')}${s.phone ? `<br>${esc(s.phone)}` : ''}</div>
        <div class="c">${timeOnly(sale.ts)} · ${esc(sale.userName)}</div>
        <div class="sep"></div>
        <table>
          <thead><tr><th>الصنف</th><th>كمية</th><th>الإجمالي</th></tr></thead>
          <tbody>
            ${sale.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${plain(i.price * i.qty)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="sep"></div>
        <div class="tot"><span>المجموع الفرعي</span><span>${plain(sale.subtotal)}</span></div>
        <div class="tot"><span>الخصم</span><span>-${plain(sale.discount)}</span></div>
        <div class="tot"><span>الضريبة</span><span>${plain(sale.tax)}</span></div>
        <div class="tot big"><span>الإجمالي</span><span>${plain(sale.total)} ${esc(s.currency)}</span></div>
        <div class="tot"><span>المستلم</span><span>${plain(sale.cashIn)}</span></div>
        <div class="tot"><span>الباقي</span><span>${plain(sale.change)}</span></div>
        <div class="foot">${esc(s.receiptFooter)}</div>
      </div>`,
    footer: `
      <button class="btn btn-outline" data-close>إغلاق</button>
      <button class="btn btn-primary" id="btnPrintAgain">${ICONS.print} طباعة</button>`
  });

  m.root.querySelector('#btnPrintAgain').addEventListener('click', () => {
    printHTML(m.root.querySelector('#receiptBody').innerHTML);
  });
  setTimeout(() => printHTML(m.root.querySelector('#receiptBody').innerHTML), 250);
}

function openHeld(root) {
  const data = db.get();
  if (!data.held.length) return toast('لا توجد سلات محفوظة', 'err');
  const m = modal({
    title: 'السلات المحفوظة',
    body: `<div class="held-list">${data.held.map(h => `
      <div class="held-row" data-id="${h.id}">
        <div>
          <strong>${timeOnly(h.ts)}</strong>
          <span class="muted">${h.items.length} صنف · ${plain(h.items.reduce((s, i) => s + i.price * i.qty, 0))}</span>
        </div>
        <div class="held-btns">
          <button class="btn btn-outline btn-sm" data-act="open">استرجاع</button>
          <button class="btn btn-danger btn-sm" data-act="drop">حذف</button>
        </div>
      </div>`).join('')}</div>`
  });

  m.root.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const row = btn.closest('.held-row');
    const id = row.dataset.id;
    if (btn.dataset.act === 'open') {
      const h = db.get().held.find(x => x.id === id);
      if (!h) return;
      state.cart = structuredClone(h.items);
      state.discount = h.discount || 0;
      db.update(d => { d.held = d.held.filter(x => x.id !== id); });
      m.close();
      repaintAll(root);
      toast('تم استرجاع السلة', 'ok');
    } else {
      db.update(d => { d.held = d.held.filter(x => x.id !== id); });
      row.remove();
      toast('تم حذف السلة المحفوظة');
    }
  });
}

export default { render, mount };
