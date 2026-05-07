// v2.17.0 — SWOT entries on Cloudflare KV.
//
// Key layout:
//   swot:{tenant}:{id}            → JSON entry
//   swot-counter:{tenant}         → integer (next id)
//   swot-list:{tenant}            → JSON [id1, id2, ...] (most recent first)

import type { KVNamespace } from '@cloudflare/workers-types';

const PERIOD_RE = /^(\d{4}-Q[1-4]|\d{4}-(0[1-9]|1[0-2])|ongoing)$/;
const VALID_CAT  = new Set(['S','W','O','T']);

function ensureKv(kv: KVNamespace | undefined): asserts kv is KVNamespace {
  if (!kv) throw new Error('GOALS_KV not configured');
}

export interface SwotInput {
  period?: string;
  category?: string;
  tag?: string;
  body?: string;
  author?: string;
}

const k       = (t: number, id: number) => `swot:${t}:${id}`;
const idxKey  = (t: number) => `swot-list:${t}`;
const ctrKey  = (t: number) => `swot-counter:${t}`;

async function nextId(kv: KVNamespace, t: number): Promise<number> {
  const raw = await kv.get(ctrKey(t));
  const next = (raw ? Number(raw) : 0) + 1;
  await kv.put(ctrKey(t), String(next));
  return next;
}

async function loadIndex(kv: KVNamespace, t: number): Promise<number[]> {
  const raw = await kv.get(idxKey(t));
  return raw ? JSON.parse(raw) : [];
}

async function saveIndex(kv: KVNamespace, t: number, ids: number[]) {
  await kv.put(idxKey(t), JSON.stringify(ids.slice(0, 5000)));
}

export async function createSwot(kv: KVNamespace, input: SwotInput, tenantId = 1) {
  ensureKv(kv);
  const period   = (input.period || '').trim();
  const category = (input.category || '').toUpperCase();
  const tag      = (input.tag || 'Strategic').trim() || 'Strategic';
  const body     = (input.body || '').trim();
  const author   = (input.author || 'system').trim() || 'system';

  if (!PERIOD_RE.test(period)) throw new Error('Invalid period — expected YYYY-Qn, YYYY-MM, or "ongoing"');
  if (!VALID_CAT.has(category)) throw new Error('category must be one of S, W, O, T');
  if (!body) throw new Error('body is required');

  const id = await nextId(kv, tenantId);
  const now = new Date().toISOString();
  const row = { id, tenant_id: tenantId, period, category, tag, body, author,
                created_at: now, updated_at: now, archived_at: null as string | null };
  await kv.put(k(tenantId, id), JSON.stringify(row));

  const ids = await loadIndex(kv, tenantId);
  ids.unshift(id);
  await saveIndex(kv, tenantId, ids);

  return row;
}

export async function getSwot(kv: KVNamespace, id: number, tenantId = 1) {
  ensureKv(kv);
  const v = await kv.get(k(tenantId, id));
  return v ? JSON.parse(v) : null;
}

export async function listSwot(kv: KVNamespace, opts: { period?: string; tag?: string; includeArchived?: boolean } = {}, tenantId = 1) {
  ensureKv(kv);
  const ids = await loadIndex(kv, tenantId);
  // Bounded fan-out: at our scale (<5000 entries) Promise.all is fine.
  const rows = await Promise.all(ids.map(id => kv.get(k(tenantId, id))));
  let entries = rows
    .map(r => r ? JSON.parse(r) : null)
    .filter(Boolean) as any[];
  if (opts.period) entries = entries.filter(e => e.period === opts.period);
  if (opts.tag)    entries = entries.filter(e => e.tag === opts.tag);
  if (!opts.includeArchived) entries = entries.filter(e => !e.archived_at);
  // Sort: category asc, then created_at desc.
  entries.sort((a, b) => {
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    return a.created_at < b.created_at ? 1 : -1;
  });
  return entries;
}

export async function updateSwot(kv: KVNamespace, id: number, input: SwotInput, tenantId = 1) {
  ensureKv(kv);
  const cur = await getSwot(kv, id, tenantId);
  if (!cur) throw new Error('Not found');
  for (const f of ['period','category','tag','body','author'] as const) {
    if (Object.prototype.hasOwnProperty.call(input, f)) (cur as any)[f] = (input as any)[f];
  }
  cur.updated_at = new Date().toISOString();
  await kv.put(k(tenantId, id), JSON.stringify(cur));
  return cur;
}

export async function archiveSwot(kv: KVNamespace, id: number, tenantId = 1) {
  ensureKv(kv);
  const cur = await getSwot(kv, id, tenantId);
  if (!cur) return;
  cur.archived_at = new Date().toISOString();
  await kv.put(k(tenantId, id), JSON.stringify(cur));
}
