const { isAdmin, withState } = require('../_lib/http.cjs');
const license = require('../_lib/license.cjs');

module.exports = withState((state, body, req) => {
  if (!isAdmin(req)) return { status: 401, body: { ok: false, error: 'unauthorized' } };
  if (req.method === 'POST') {
    const count = Math.min(Math.max(Number(body.count) || 1, 1), 500);
    const made = license.issue(state, count, body.plan, body.note);
    return { status: 201, body: { ok: true, keys: made.map(r => r.key) }, mutated: true };
  }
  const data = license.list(state);
  return { status: 200, body: { ok: true, ...data } };
});
