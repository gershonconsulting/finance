// Shown by GET /auth/login when Xero credentials are not configured.
// Never contains or restores any credential; it only names the missing
// Cloudflare Pages variables.
export const XERO_CONFIG_MESSAGE =
  'Xero sign-in is not configured: XERO_CLIENT_ID / XERO_CLIENT_SECRET missing in Cloudflare Pages Production';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string
  ));
}

export function xeroNotConfiguredPage(version: string): string {
  const v = esc(String(version));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Xero sign-in not configured</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff5f5;color:#222;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
main{max-width:560px;background:#fff;border:1px solid #f1c4c0;border-top:4px solid #FE1B04;border-radius:8px;padding:24px}
h1{font-size:1.25rem;margin:0 0 12px;color:#d11200}
code{background:#f4f4f4;padding:2px 5px;border-radius:4px}
small{color:#666}
</style></head><body><main>
<h1>Xero sign-in is not configured</h1>
<p>${esc(XERO_CONFIG_MESSAGE)}.</p>
<p>An administrator needs to add <code>XERO_CLIENT_ID</code> and <code>XERO_CLIENT_SECRET</code> as
Production variables on the Cloudflare Pages project, then redeploy.</p>
<p><small>Gershon Finance v${v}</small></p>
</main></body></html>`;
}
