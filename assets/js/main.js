(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const CFG = window.MERO_CONFIG || {};

  const nav = $('#nav');
  const navLinks = $('#navLinks');
  const navToggle = $('#navToggle');

  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  });

  $$('#navLinks a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }));

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -40px' });
  $$('.reveal').forEach(el => io.observe(el));

  $$('.card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  const counters = $$('.stat-num');
  const cio = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = +el.dataset.count;
      const t0 = performance.now();
      const dur = 1400;
      const tick = now => {
        const p = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      cio.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => cio.observe(c));

  const products = [
    { emo: '☕', nm: 'قهوة', pr: 12 },
    { emo: '🥐', nm: 'كرواسون', pr: 8 },
    { emo: '🥤', nm: 'عصير', pr: 9 },
    { emo: '🍔', pr: 24, nm: 'برجر' },
    { emo: '🍕', pr: 30, nm: 'بيتزا' },
    { emo: '🍰', pr: 15, nm: 'كيك' },
    { emo: '🥗', pr: 18, nm: 'سلطة' },
    { emo: '🧃', pr: 5, nm: 'مشروب' },
    { emo: '🍫', pr: 6, nm: 'شوكولاتة' }
  ];

  const grid = $('#posProducts');
  const rows = $('#posRows');
  const totalEl = $('#posTotal');
  const payBtn = $('#posPay');
  let total = 0;

  if (grid) {
    grid.innerHTML = products.map(p => `
      <div class="pos-item" data-pr="${p.pr}" data-nm="${p.nm}">
        <div class="emo">${p.emo}</div>
        <div class="nm">${p.nm}</div>
        <div class="pr">${p.pr}.00</div>
      </div>`).join('');

    grid.addEventListener('click', e => {
      const item = e.target.closest('.pos-item');
      if (!item) return;
      const pr = +item.dataset.pr;
      total += pr;
      totalEl.textContent = total.toFixed(2);
      const row = document.createElement('div');
      row.innerHTML = `<span>${item.dataset.nm}</span><span>${pr.toFixed(2)}</span>`;
      rows.prepend(row);
      while (rows.children.length > 5) rows.lastElementChild.remove();
    });

    payBtn.addEventListener('click', () => {
      if (!total) { totalEl.textContent = '0.00'; return; }
      totalEl.textContent = '✓';
      payBtn.textContent = 'تم الدفع';
      setTimeout(() => {
        total = 0;
        rows.innerHTML = '';
        totalEl.textContent = '0.00';
        payBtn.textContent = 'إتمام البيع';
      }, 1300);
    });
  }

  const priceToggle = $('#priceToggle');
  if (priceToggle) {
    priceToggle.addEventListener('click', () => {
      const yearly = priceToggle.getAttribute('aria-checked') !== 'true';
      priceToggle.setAttribute('aria-checked', String(yearly));
      $('#labMonthly').classList.toggle('active', !yearly);
      $('#labYearly').classList.toggle('active', yearly);
      $$('.amount').forEach(a => { a.textContent = yearly ? a.dataset.y : a.dataset.m; });
      $$('.per').forEach(p => { if (p.dataset.m && p.dataset.y) p.textContent = yearly ? p.dataset.y : p.dataset.m; });
    });
  }

  $$('.faq-item').forEach(item => {
    item.addEventListener('toggle', () => {
      if (item.open) $$('.faq-item').forEach(o => o !== item && (o.open = false));
    });
  });

  const form = $('#ctaForm');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const note = $('#formNote');
      const name = $('#cName').value.trim();
      const mail = $('#cMail').value.trim();
      const phone = $('#cPhone').value.trim();
      const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail);
      if (!name || !okMail) {
        note.textContent = 'الرجاء إدخال الاسم وبريد إلكتروني صحيح.';
        note.classList.add('err');
        return;
      }

      const btn = $('#ctaBtn');
      btn.disabled = true;
      btn.textContent = 'جارٍ الإرسال...';
      note.textContent = '';
      note.classList.remove('err');

      if (CFG.formEndpoint) {
        try {
          const res = await fetch(CFG.formEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ name, email: mail, phone, source: 'merodev-landing' })
          });
          if (!res.ok) throw new Error(String(res.status));
        } catch {
          btn.disabled = false;
          btn.textContent = 'اطلب النسخة التجريبية';
          note.textContent = 'تعذّر الإرسال. تواصل معنا على الواتساب أو البريد.';
          note.classList.add('err');
          return;
        }
      }

      setTimeout(() => {
        btn.textContent = 'تم الإرسال ✓';
        note.textContent = `شكرًا ${name}! سنتواصل معك خلال 24 ساعة.`;
        note.classList.remove('err');
        form.reset();
        setTimeout(() => { btn.disabled = false; btn.textContent = 'اطلب النسخة التجريبية'; }, 2500);
      }, 700);
    });
  }

  const PLAN_LABELS = {
    basic: 'الترخيص الأساسي — 1500 ج.م دفعة واحدة أو 800 ج.م/سنة',
    pro: 'الترخيص الاحترافي — 3500 ج.م دفعة واحدة أو 1800 ج.م/سنة',
    enterprise: 'ترخيص المؤسسات — 6000 ج.م دفعة واحدة أو 1500 ج.م/سنة لكل جهاز'
  };

  $$('[data-buy]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const plan = btn.dataset.buy;
      const label = PLAN_LABELS[plan] || plan;

      if (CFG.checkout) {
        const url = new URL(CFG.checkout);
        url.searchParams.set('plan', plan);
        if (CFG.demoKey) url.searchParams.set('discount', CFG.demoKey);
        window.open(url.toString(), '_blank', 'noopener');
        return;
      }

      const phone = String(CFG.whatsapp || '').replace(/\D/g, '');
      if (!phone) {
        document.querySelector('#contact').scrollIntoView({ behavior: 'smooth' });
        toast('املأ النموذج وسنتواصل معك لإتمام الطلب');
        return;
      }
      const text = `مرحبًا، عايز أطلب ${label}\n(من موقع Mero Dev)`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    });
  });

  $$('[data-download]').forEach(btn => {
    btn.addEventListener('click', e => {
      const url = CFG.downloads && CFG.downloads[btn.dataset.download];
      if (!url) return;
      e.preventDefault();
      if (btn.dataset.download === 'web') window.open(url, '_blank', 'noopener');
      else window.location.href = url;
    });
  });

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fillPayments = () => {
    const grid = document.querySelector('#payGrid');
    if (!grid) return;
    const items = [];
    if (CFG.instapay) items.push({ t: 'إنستاباي', v: CFG.instapay });
    if (CFG.vodafoneCash) items.push({ t: 'فودافون كاش', v: CFG.vodafoneCash });
    if (CFG.whatsapp) {
      const phone = String(CFG.whatsapp).replace(/\D/g, '');
      items.push({ t: 'واتساب', v: `اضغط للتواصل والمتابعة`, link: `https://wa.me/${phone}` });
    }
    if (CFG.email) items.push({ t: 'بريد إلكتروني', v: CFG.email });
    grid.innerHTML = items.map(i => `
      <div class="pay-item">
        <span class="pay-t">${esc(i.t)}</span>
        <span class="pay-v">${i.link ? `<a href="${i.link}" target="_blank" rel="noopener">${esc(i.v)}</a>` : esc(i.v)}</span>
      </div>`).join('');
  };
  fillPayments();

  const bar = $('#consoleBar');
  if (bar) {
    const widths = [35, 62, 88, 48, 74];
    let i = 0;
    setInterval(() => { bar.style.width = widths[i++ % widths.length] + '%'; }, 2000);
  }

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
