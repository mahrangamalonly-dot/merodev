const fs = require('fs');
const path = require('path');

const STATE_KEY = 'mero:license:v1';

const sources = [
  { name: 'vercel-kv', url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN },
  { name: 'upstash', url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }
].filter(s => s.url && s.token);

const empty = () => ({ keys: [], orders: [] });

const base = source => source.url.replace(/\/+$/, '');

async function kvGet(source, key) {
  const res = await fetch(`${base(source)}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${source.token}` }
  });
  if (!res.ok) throw new Error(`kv_http_${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(String(data.error));
  return typeof data.result === 'string' ? JSON.parse(data.result) : empty();
}

async function kvSet(source, key, value) {
  const res = await fetch(`${base(source)}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${source.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', key, value]])
  });
  if (!res.ok) throw new Error(`kv_http_${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data[0]?.error) throw new Error(String(data[0]?.error || 'kv_set_failed'));
}

const localFile = root => path.join(root || process.cwd(), 'data', 'license.json');

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

async function load(root) {
  for (const source of sources) {
    try {
      return await kvGet(source, STATE_KEY);
    } catch (err) {
      console.error(`store: read ${source.name} failed ->`, err.message);
    }
  }
  return readLocal(root);
}

async function save(state, root) {
  for (const source of sources) {
    try {
      await kvSet(source, STATE_KEY, JSON.stringify(state));
      return;
    } catch (err) {
      console.error(`store: write ${source.name} failed ->`, err.message);
    }
  }
  try {
    writeLocal(state, root);
  } catch (err) {
    console.error('store: local write failed ->', err.message);
  }
}

module.exports = {
  hasKV: () => sources.length > 0,
  sourceNames: () => sources.map(s => s.name),
  load,
  save
};
