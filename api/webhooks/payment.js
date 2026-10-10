const crypto = require('crypto');
const store = require('./_lib/store.cjs');
const license = require('./_lib/license.cjs');
const { send } = require('./_lib/http.cjs');

module.exports = async (req, res) => {
  try {
    const raw = await new Promise((resolve, reject) => {
      let b = '';
      req.on('data', c => { b += c; if (b.length > 1e6) { reject(new Error('too large')); req.destroy(); } });
      req.on('end', () => resolve(b));
      req.on('error', reject);
    });

    const secret = process.env.WEBHOOK_SECRET || '';
    if (secret) {
      const sig = req.headers['x-signature'] || '';
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const a = Buffer.from(String(sig), 'utf8');
      const b = Buffer.from(expected, 'utf8');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return send(res, 401, { ok: false, error: 'bad_signature' });
      }
    }

    const state = await store.load();
    const result = license.payment(state, JSON.parse(raw || '{}'));
    if (result.body.ok) await store.save(state);
    send(res, result.status, result.body);
  } catch (err) {
    send(res, 400, { ok: false, error: err.message });
  }
};
