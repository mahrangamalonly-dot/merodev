const BASE = process.env.LS_URL || 'http://127.0.0.1:8787';
const TOKEN = process.env.ADMIN_TOKEN || 'change-me-admin-token';

const [, , cmd, ...args] = process.argv;

async function call(path, method = 'GET', body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`خطأ ${res.status}:`, data.error || data);
    process.exit(1);
  }
  return data;
}

const usage = () => console.log(`
أوامر إدارة التراخيص:
  batch <count> [plan]     توليد مفاتيح (basic|pro|enterprise)
  list                     عرض كل المفاتيح
  orders                   عرض كل الطلبات
  revoke <key>             إلغاء مفتاح
  health                   حالة السيرفر
`);

(async () => {
  if (cmd === 'batch') {
    const count = Number(args[0]) || 1;
    const plan = args[1] || 'basic';
    const r = await call('/admin/keys', 'POST', { count, plan });
    console.log(r.keys.join('\n'));
    return;
  }
  if (cmd === 'list') {
    const r = await call('/admin/keys');
    if (!r.keys.length) return console.log('لا توجد مفاتيح');
    r.keys.forEach(k => console.log(
      `${k.key}  ${k.plan}  ${k.deviceCount}/${k.maxDevices}  ${k.status}`
    ));
    return;
  }
  if (cmd === 'orders') {
    const r = await call('/admin/keys');
    if (!r.orders.length) return console.log('لا توجد طلبات');
    r.orders.forEach(o => console.log(`${o.createdAt}  ${o.id}  ${o.plan} x${o.devices}  ${o.key}`));
    return;
  }
  if (cmd === 'revoke') {
    await call('/admin/revoke', 'POST', { key: args[0] });
    console.log('تم إلغاء المفتاح');
    return;
  }
  if (cmd === 'health') {
    const r = await call('/health');
    console.log('السيرفر يعمل:', r);
    return;
  }
  usage();
})();
