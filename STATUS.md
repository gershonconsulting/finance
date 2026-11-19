# finance.gershon.ai — status
Last updated: 2026-11-19 · v2.23.4 (Xero-fallbacks work still HELD: secrets, PR #19)

## Current state
- Hono on Cloudflare Pages (project gershon-finance). Xero-backed accounts receivable.
- Headless access: server-side Xero credential in GOALS_KV (service token), renewed by every signed-in visit; expires if unused for 60 days.
- Deploy route: merge to main → .github/workflows/deploy.yml deploys.

## ✅ Done
- ✅ v2.21.0 weekly/monthly e-mail reports run headless (/api/cron/run).
- ✅ v2.22.0 Legal section; Sheets/Extract integrations removed.
- ✅ v2.23.0 (2026-11-10): POST /api/machine/clients — read-only per-client invoice figures (invoiced, paid, owed, overdue, months late, grade) for health.gershon.ai's Business tab. Auth = SHA-256 of the client-platform-matrix secret; no new secret.

- ✅ v2.23.1 (PR #14, not merged): brand red #FE1B04 / dark #d11200 / tint #fff5f5 replaces #CC3333 in app, login/404, emails; derived shades retuned. Semantic error reds kept. Awaiting visual test.
- ✅ v2.23.1 (2026-11-14): brand red #FE1B04 (dark #d11200, tint #fff5f5) (PR #14).
- ✅ v2.23.2 (2026-11-14): version single source = package.json; /api/health and home footer read it (PR #15).

- ✅ v2.23.3 (2026-11-18, HELD, not merged): Xero client ID/secret fallbacks removed from src/index.tsx and server.js; env only (XERO_CLIENT_ID, XERO_CLIENT_SECRET); missing -> 500 JSON 'Xero not configured'.

- ✅ v2.23.4 (2026-11-19): naming "Finance by Gershon.AI" — /app title + sidebar wordmark, home title/og:title; applied at build by scripts/inject-timestamp.mjs (public/index.html untouched). 404/sign-in titles in src/index.tsx left as is (avoid touching auth code while PR #19 is held).

## ❌ Open
- ❌ HELD: secrets. Before merging v2.23.3 Charles must confirm XERO_CLIENT_ID + XERO_CLIENT_SECRET exist in Pages (Production), then rotate the Xero client secret in the Xero developer portal and update the env var; then Olivier says OK. Old values remain in git history and some legacy docs/public/static files (client ID).
- ❌ ~90 legacy status docs at the root — archive into /docs.

## Known issues
- If the server-side Xero credential is missing or older than 60 days, /api/machine/clients returns 503 until someone signs in once.
