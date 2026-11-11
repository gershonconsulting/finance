# Finance (finance.gershon.ai) - status

Updated 2026-11-11 (wave 3).

## Version
v2.22.1 (branch nightly/2026-11-11-finance-brand-red). Main was v2.22.0.
Open PR #13 (claude/machine-clients, v2.23.0) is independent; if it merges
first, bump on merge.

## Done (ready to test)
- Brand red switched: #CC3333 -> #FE1B04, dark #a8281f -> #d11200,
  tint #fdf2f2 -> #fff5f5, rgb(204,51,51) -> rgb(254,27,4).
- Scope: src/index.tsx (login + 404 pages, changelog), email-reports.ts,
  public/index.html, home.html, dashboard-shot.svg, static/overview.*,
  static/unified-theme.*, static/client-profile.js.

## Left on purpose
- Semantic error/status reds (#b91c1c, #dc2626, #c33 in styles.css) are a
  separate colour family, untouched.
- Derived accents not in the brief: #e06a6a, #f3caca (tint line), #7a1d16 and
  #5a1a14 (dark hero gradients). Still the old hue; retune if wanted.

## Tests
- node --check on all public/static/*.js: pass.
- vite build: pass. tsc --noEmit reports pre-existing lib errors
  (btoa/fetch/console) unrelated to this change.
- No automated test suite (npm test is a curl smoke).

## Open
- Not deployed. Visual check on preview needed.
- Older *.md fix notes in root are historical.
