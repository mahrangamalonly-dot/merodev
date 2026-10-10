const fs = require('fs');
const path = require('path');

const STATE_KEY = 'mero:license:v1';

const sources = [
  { name: 'vercel-kv', url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN },
  { name: 'upstash', url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }
].filter(s => s.url && s.token);

const empty = () => ({ keys: [], orders: [] });

function localFile(root) {
  return path.join(root || process.cwd(), 'data', 'license.json');
}

async function kvGet(source, key) {
  const url = `${source.url.replace(/\/+$/, '')}/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${source.token}` } });
  if (!res.ok) throw new Error(`kv_http_${res.status}`);
  const data = await res.json();
  return typeof data.result === 'string' ? JSON.parse(data.result) : empty();
}

async function kvSet(source, key, value) {
  const url = `${source.url.replace(/\/+$/, '')}/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${source.token}` }
  });
  if (!res.ok) throw new Error(`kv_http_${res.status}`);
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

let cached = null;

async function load(root) {
  if (cached) return cached;
  for (const source of sources) {
    try {
      cached = await kvGet(source, STATE_KEY);
      return cached;
    } catch (err) {
      console.error(`store: ${source.name} failed`, err.message);
    }
  }
  return readLocal(root);
}

async function save(state, root) {
  cached = state;
  for (const source of sources) {
    try {
      await kvSet(source, STATE_KEY, JSON.stringify(state));
      return;
    } catch (err) {
      console.error(`store: ${source.name} save failed`, err.message);
    }
  }
  writeLocal(state, root);
}

module.exports = {
  hasKV: () => sources.length > 0,
  sourceNames: () => sources.map(s => s.name),
  load,
  save
};
