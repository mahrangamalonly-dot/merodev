const { send } = require('./_lib/http.cjs');
const store = require('./_lib/store.cjs');

module.exports = (req, res) => {
  send(res, 200, {
    ok: true,
    service: 'mero-license',
    storage: store.hasKV() ? store.sourceNames().join('+') : 'local'
  });
};
