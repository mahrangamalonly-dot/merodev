const { isAdmin, withState } = require('../_lib/http.cjs');
const license = require('../_lib/license.cjs');

module.exports = withState((state, body, req) => {
  if (!isAdmin(req)) return { status: 401, body: { ok: false, error: 'unauthorized' } };
  const result = license.reactivate(state, body);
  return { ...result, mutated: result.body.ok === true };
});
