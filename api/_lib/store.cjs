const fs = require('fs');
const path = require('path');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const STATE_KEY = 'mero:license:v1';

const empty = () => ({ keys: [], orders: [] });

function localFile(root) {
  return path.join(root || process.cwd(), 'data', 'license.json');
}

async function kvCommand(command) {
  const base = KV_URL.replace(/\/+$/, '');
  const route = Array.isArray(command) ? command : [command];
  const url = `${base}/${route.map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  if (!res.ok) throw new Error(`kv_http_${res.status}`);
  return res.json();
}

async function readKV() {
  const data = await kvCommand(['get', STATE_KEY]);
  if (data && typeof data.result === 'string') return JSON.parse(data.result);
  return empty();
}

async function writeKV(state) {
  await kvCommand(['set', STATE_KEY, JSON.stringify(state)]);
}

function readLocal(root) {
  try {
    return JSON.parse(fs.readFileSync(localFile(root), 'utf8'));
  } catch {
    return empty();
  }
}

function writeLocal(state, root) {
  const file = localFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

const hasKV = () => Boolean(KV_URL && KV_TOKEN);
module.exports = {
  hasKV,
  async load(root) {
    if (hasKV()) return readKV();
    return readLocal(root);
  },
  async save(state, root) {
    if (hasKV()) return writeKV(state);
    writeLocal(state, root);
  }
};
