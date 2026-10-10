const { send } = require('./_lib/http.cjs');

module.exports = (req, res) => {
  send(res, 200, {
    ok: true,
    service: 'mero-license',
    storage: process.env.KV_REST_API_URL ? 'kv' : 'local'
  });
};
