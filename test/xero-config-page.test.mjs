// Run: node --experimental-strip-types --test test/xero-config-page.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { xeroNotConfiguredPage, XERO_CONFIG_MESSAGE } from '../src/services/xero-config-page.ts';

test('page names the missing variables and the version', () => {
  const html = xeroNotConfiguredPage('2.23.4');
  assert.match(html, /XERO_CLIENT_ID \/ XERO_CLIENT_SECRET missing in Cloudflare Pages Production/);
  assert.match(html, /v2\.23\.4/);
  assert.ok(html.includes(XERO_CONFIG_MESSAGE));
});

test('version is HTML-escaped and no credential-looking content', () => {
  const html = xeroNotConfiguredPage('<script>x</script>');
  assert.ok(!html.includes('<script>x'));
  assert.ok(!/client_?secret\s*[:=]\s*\S{20,}/i.test(html));
});
