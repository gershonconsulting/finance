// v2.21.0 — Server-side Xero credential so scheduled reports can run with nobody
// signed in. Stored in GOALS_KV under `xero_service_token`.
//
// Xero rotates the refresh token on every use, so the browser and the server
// must share ONE chain: whoever refreshes writes the new token here, and every
// refresh (browser or cron) starts from the newest token held here. The
// browser receives the rotated session on the `X-Session-Refresh` header.

import { XeroOAuthService } from './xero-oauth';

export const SERVICE_TOKEN_KEY = 'xero_service_token';

export interface ServiceToken {
  accessToken?: string;
  refreshToken: string;
  tenantId: string;
  expiresAt?: number;
  updatedAt: string;
  source: string;
}

export async function readServiceToken(kv: KVNamespace | undefined): Promise<ServiceToken | null> {
  if (!kv) return null;
  try { const v = await kv.get(SERVICE_TOKEN_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}

export async function writeServiceToken(kv: KVNamespace | undefined, t: Omit<ServiceToken, 'updatedAt'>) {
  if (!kv || !t.refreshToken || !t.tenantId) return;
  try { await kv.put(SERVICE_TOKEN_KEY, JSON.stringify({ ...t, updatedAt: new Date().toISOString() })); } catch (e) { console.error('writeServiceToken', e); }
}

/** A valid access token for the stored tenant, refreshing (and persisting the rotation) when needed. */
export async function getServiceAccess(kv: KVNamespace | undefined, oauth: XeroOAuthService, source = 'cron'):
  Promise<{ accessToken: string; refreshToken: string; tenantId: string; expiresAt: number } | null> {
  const t = await readServiceToken(kv);
  if (!t) return null;
  if (t.accessToken && t.expiresAt && t.expiresAt - Date.now() > 5 * 60 * 1000) {
    return { accessToken: t.accessToken, refreshToken: t.refreshToken, tenantId: t.tenantId, expiresAt: t.expiresAt };
  }
  const fresh = await oauth.refreshAccessToken(t.refreshToken);
  await writeServiceToken(kv, { accessToken: fresh.accessToken, refreshToken: fresh.refreshToken, tenantId: t.tenantId, expiresAt: fresh.expiresAt, source });
  return { accessToken: fresh.accessToken, refreshToken: fresh.refreshToken, tenantId: t.tenantId, expiresAt: fresh.expiresAt };
}
