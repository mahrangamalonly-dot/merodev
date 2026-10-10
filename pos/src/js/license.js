const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RE = /^MERO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function checksum(head) {
  let sum = 0;
  [...head].forEach((c, i) => { sum += c.charCodeAt(0) * (i + 7); });
  let h = sum % 1679616;
  let out = '';
  for (let i = 0; i < 4; i++) {
    out = ALPHA[h % 36] + out;
    h = Math.floor(h / 36);
  }
  return out;
}

export function validateKey(key) {
  const k = String(key || '').trim().toUpperCase().replace(/\s/g, '');
  if (!RE.test(k)) return false;
  const [, a, b, c] = k.split('-');
  return checksum(a + b) === c;
}

export function maskKey(key) {
  const parts = String(key || '').split('-');
  if (parts.length < 4) return key || '';
  return `${parts[0]}-${parts[1]}-****-${parts[3]}`;
}
