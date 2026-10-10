const { withState } = require('./_lib/http.cjs');
const license = require('./_lib/license.cjs');

module.exports = withState((state, body) => {
  const result = license.deactivate(state, body);
  return { ...result, mutated: true };
});
