const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RE = /^MERO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function checksum(head) {
  let sum = 0;
  [...head].forEach((c, i) => { sum += c.charCodeAt(0) * (i + 7); });
  let h = sum % 1679616;
  let out = '';
  for (let i = 0; i < 4; i++) { out = ALPHA[h % 36] + out; h = Math.floor(h / 36); }
  return out;
}

export const validateKey = key => RE.test(String(key || '').trim().toUpperCase());
export const normalize = key => String(key || '').trim().toUpperCase();
export const maskKey = key => {
  const p = String(key || '').split('-');
  return p.length >= 4 ? `${p[0]}-${p[1]}-****-${p[3]}` : key;
};

export async function callServer(server, path, body) {
  const base = String(server || '').replace(/\/+$/, '');
  if (!base) return { error: 'no_server' };
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok !== true) return { error: data.error || 'key_not_found', data };
    return { ok: true, data };
  } catch (err) {
    return { error: 'network', detail: String(err && err.message || err).slice(0, 100) };
  }
}

export const ERRORS = {
  key_not_found: 'هذا المفتاح غير مسجّل. تأكد من المفتاح أو تواصل مع البائع.',
  key_revoked: 'هذا المفتاح ملغى. تواصل مع البائع لاستبداله.',
  key_expired: 'انتهت صلاحية هذا المفتاح.',
  device_limit_reached: 'تم استخدام الحد الأقصى من الأجهزة لهذا المفتاح.',
  device_deactivated: 'تم إلغاء تنشيط هذا الجهاز. تواصل مع المورد لإعادة التنشيط.',
  device_required: 'تعذّر التعرف على هذا الجهاز.',
  no_server: 'لم يتم تحديد سيرفر الترخيص.',
  network: 'تعذّر الاتصال بسيرفر الترخيص. تحقق من الإنترنت وحاول مرة أخرى.'
};
