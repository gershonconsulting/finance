// Build entry (vite.config.ts -> pages({ entry })). Wraps the app so that
// GET /auth/login shows a readable page, instead of a bare JSON 500, when the
// Xero credentials are missing from the Cloudflare Pages environment.
// Everything else is served by ./index unchanged. No credential is read out,
// logged or re-added here; only presence is checked.
import { Hono } from 'hono';
import app from './index';
import { xeroNotConfiguredPage } from './services/xero-config-page';
import pkg from '../package.json';

const entry = new Hono<{ Bindings: { XERO_CLIENT_ID?: string; XERO_CLIENT_SECRET?: string } }>();

entry.get('/auth/login', async (c, next) => {
  if (!c.env?.XERO_CLIENT_ID || !c.env?.XERO_CLIENT_SECRET) {
    // Same 500 status as before so monitors keep working.
    return c.html(xeroNotConfiguredPage(pkg.version), 500);
  }
  await next();
});

entry.route('/', app as any);

export default entry;
