# finance.gershon.ai — status
Last updated: 2026-11-12 · v2.23.1 (branch nightly/2026-11-11-finance-brand-red, PR #14)

## Current state
- Hono on Cloudflare Pages (project gershon-finance). Xero-backed accounts receivable.
- Headless access: server-side Xero credential in GOALS_KV (service token), renewed by every signed-in visit; expires if unused for 60 days.
- Deploy route: merge to main → .github/workflows/deploy.yml deploys.

## ✅ Done
- ✅ v2.21.0 weekly/monthly e-mail reports run headless (/api/cron/run).
- ✅ v2.22.0 Legal section; Sheets/Extract integrations removed.
- ✅ v2.23.0 (2026-11-10): POST /api/machine/clients — read-only per-client invoice figures (invoiced, paid, owed, overdue, months late, grade) for health.gershon.ai's Business tab. Auth = SHA-256 of the client-platform-matrix secret; no new secret.

- ✅ v2.23.1 (PR #14, not merged): brand red #FE1B04 / dark #d11200 / tint #fff5f5 replaces #CC3333 in app, login/404, emails; derived shades retuned. Semantic error reds kept. Awaiting visual test.

## ❌ Open
- ❌ Xero client ID/secret hard-coded as fallbacks in src/index.tsx and server.js — move to Pages secrets and rotate (needs Olivier's go-ahead).
- ❌ ~90 legacy status docs at the root — archive into /docs.

## Known issues
- If the server-side Xero credential is missing or older than 60 days, /api/machine/clients returns 503 until someone signs in once.
