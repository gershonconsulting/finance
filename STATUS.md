# STATUS — gershonconsulting/finance
Last updated: 2026-11-09

## Live
- v2.22.0 on https://finance.gershoncrm.com (main f9bca71) — Legal section, Sheets/Extract removed.
- Deploy: push to main → .github/workflows/deploy.yml → Cloudflare Pages `gershon-finance`.

## Done ✅
- ✅ Legal: clients with an invoice ≥180 days past due (KV `legal_settings`) or flagged manually are excluded from owed/overdue/ageing/DSO/collection rate/alerts.
- ✅ Google Sheets + Extract Data tabs and /api/sheets/*, /api/extract/* removed.
- ✅ finance.gershon.ai attached to Pages project (status pending — waits for DNS) via .github/workflows/custom-domain.yml (branch ops/custom-domain).

## Open ❌
- ❌ DNS: CNAME `finance` → `gershon-finance.pages.dev` (proxied) in zone gershon.ai. The deploy token has no DNS permission; the Oattia Chrome Cloudflare login is a different account (no zones).
- ❌ Xero developer app: add redirect URI https://finance.gershon.ai/auth/callback (Oattia Chrome signed out of Xero).
- ❌ Then: Pages var CANONICAL_REDIRECT=on; switch DASH_URL (src/services/email-reports.ts) and cron URL (.github/workflows/finance-reports.yml) to finance.gershon.ai.
- ❌ Resend key + one Xero sign-in for automatic e-mail reports (from v2.21.0).
