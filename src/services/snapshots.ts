// v2.17.0 — Monthly snapshots service. Backed by Cloudflare KV (GOALS_KV namespace).
//
// Key layout:
//   snap:{tenant}:{YYYY-MM}              → JSON snapshot (one row)
//   snap-list:{tenant}                   → JSON ["YYYY-MM", "YYYY-MM", ...] (sorted desc, capped)
// We also keep the per-period key as the source of truth; the list key is a
// secondary index to avoid expensive prefix scans on every read.

import type { KVNamespace } from '@cloudflare/workers-types';

export const SNAPSHOT_COLS = [
  'revenue_paid','revenue_invoiced','active_clients','new_clients',
  'cash_position','gross_margin_pct','dso_days','collection_rate_pct',
  'payment_velocity_days',
  'ar_total','ar_overdue','ar_aging_current','ar_aging_30_60','ar_aging_60_90','ar_aging_90plus','overdue_count',
  'ap_total','net_cash_flow',
  'loc_recommended','loc_dscr','borrowing_base',
  'bank_score_community','bank_score_sba','bank_score_fintech',
  'goal_revenue_target','goal_clients_target','goal_collection_pct',
] as const;

export type SnapshotInput = Partial<Record<typeof SNAPSHOT_COLS[number], number | null>> & {
  period: string;
  source?: 'cron' | 'manual' | 'backfill';
  payload?: unknown;
};

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function ensureKv(kv: KVNamespace | undefined): asserts kv is KVNamespace {
  if (!kv) throw new Error('GOALS_KV not configured');
}

const snapKey = (tenantId: number, period: string) => `snap:${tenantId}:${period}`;
const idxKey  = (tenantId: number) => `snap-list:${tenantId}`;

export async function upsertSnapshot(kv: KVNamespace, body: SnapshotInput, tenantId = 1) {
  ensureKv(kv);
  if (!PERIOD_RE.test(body.period)) throw new Error('Invalid period (expected YYYY-MM)');
  const source = (['cron','manual','backfill'] as const).includes(body.source as any)
    ? body.source : 'cron';

  // Build the persisted row from known columns + payload.
  const row: Record<string, unknown> = {
    tenant_id: tenantId,
    period: body.period,
    captured_at: new Date().toISOString(),
    source,
  };
  for (const c of SNAPSHOT_COLS) {
    if (Object.prototype.hasOwnProperty.call(body, c)) row[c] = (body as any)[c];
  }
  row.payload_json = body.payload ?? null;

  await kv.put(snapKey(tenantId, body.period), JSON.stringify(row));

  // Maintain the index — sorted desc by period, deduped, capped at 240 entries.
  const idxRaw = await kv.get(idxKey(tenantId));
  let periods: string[] = idxRaw ? JSON.parse(idxRaw) : [];
  periods = Array.from(new Set([body.period, ...periods]))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 240);
  await kv.put(idxKey(tenantId), JSON.stringify(periods));

  return row;
}

export async function getSnapshot(kv: KVNamespace, period: string, tenantId = 1) {
  ensureKv(kv);
  const v = await kv.get(snapKey(tenantId, period));
  return v ? JSON.parse(v) : null;
}

export async function listSnapshots(kv: KVNamespace, opts: { from?: string; to?: string } = {}, tenantId = 1) {
  ensureKv(kv);
  const idxRaw = await kv.get(idxKey(tenantId));
  let periods: string[] = idxRaw ? JSON.parse(idxRaw) : [];
  if (opts.from && PERIOD_RE.test(opts.from)) periods = periods.filter(p => p >= opts.from!);
  if (opts.to   && PERIOD_RE.test(opts.to))   periods = periods.filter(p => p <= opts.to!);
  // Already sorted desc.
  const rows = await Promise.all(periods.map(p => kv.get(snapKey(tenantId, p))));
  return rows.map(r => r ? JSON.parse(r) : null).filter(Boolean);
}

export async function momSeries(kv: KVNamespace, metric: string, months = 12, tenantId = 1) {
  ensureKv(kv);
  if (!(SNAPSHOT_COLS as readonly string[]).includes(metric)) {
    throw new Error('Unknown metric');
  }
  const n = Math.max(1, Math.min(60, months));
  const all = await listSnapshots(kv, {}, tenantId);          // most recent first
  const window = all.slice(0, n).reverse();                   // ascending order for charts
  const series = window.map((r: any) => ({
    period: r.period,
    value:  r[metric] != null ? Number(r[metric]) : null,
  }));
  let delta: any = null;
  if (series.length >= 2) {
    const cur  = Number(series.at(-1)!.value || 0);
    const prev = Number(series.at(-2)!.value || 0);
    delta = {
      mom_abs: round2(cur - prev),
      mom_pct: prev !== 0 ? round2((cur - prev) / prev * 100) : null,
    };
    if (series.length >= 13) {
      const yoy = Number(series.at(-13)!.value || 0);
      delta.yoy_abs = round2(cur - yoy);
      delta.yoy_pct = yoy !== 0 ? round2((cur - yoy) / yoy * 100) : null;
    }
  }
  return { metric, series, delta };
}

function round2(n: number) { return Math.round(n * 100) / 100; }

// Audit log — append-only list under audit:{tenant}, capped at 1000 entries.
export async function audit(kv: KVNamespace, action: string, target: string, payload: unknown, actor = 'cf-worker', tenantId = 1) {
  ensureKv(kv);
  const k = `audit:${tenantId}`;
  const raw = await kv.get(k);
  const arr: any[] = raw ? JSON.parse(raw) : [];
  arr.unshift({ at: new Date().toISOString(), actor, action, target, payload });
  await kv.put(k, JSON.stringify(arr.slice(0, 1000)));
}
