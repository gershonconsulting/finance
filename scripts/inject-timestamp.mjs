import { readFileSync, writeFileSync } from 'fs'

const now = new Date()
const timestamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
}).format(now)

// v2.19.1 — package.json is the single source of truth for the version shown
// in the dashboard sidebar and for the cache-busting ?v= on the theme files,
// so a version bump no longer needs an edit to the 120 KB public/index.html.
const version = JSON.parse(readFileSync('package.json', 'utf8')).version

const file = 'dist/index.html'
const html = readFileSync(file, 'utf8')
  .replace('__BUILD_TIMESTAMP__', timestamp)
  .replace(/(class="brand-version">)v\d+\.\d+\.\d+/, `$1v${version}`)
  .replace(/(unified-theme\.(?:css|js)\?v=)\d+\.\d+\.\d+/g, `$1${version}`)
  // v2.23.4 — app naming "<App> by Gershon.AI" (title + sidebar wordmark).
  .replace('<title>Gershon.AI · Finance</title>', '<title>Finance by Gershon.AI</title>')
  .replace(/(<div class="brand-title"><i class="fas fa-chart-line"><\/i>)Gershon\.AI(<\/div>\s*<div class="brand-sub">)Finance(<\/div>)/, '$1Finance$2by Gershon.AI$3')
writeFileSync(file, html)

// v2.23.2 — the public home page footer was hard-coded (stuck on v2.20.0).
// Same rule: package.json is the only place the version is written.
const homeFile = 'dist/home.html'
writeFileSync(
  homeFile,
  readFileSync(homeFile, 'utf8').replace(/(class="ver">· v)\d+\.\d+\.\d+/, `$1${version}`)
    // v2.23.4 — naming: page title + og:title "Finance by Gershon.AI — …"
    .replace(/(<title>|og:title" content=")Gershon\.AI Finance — /g, '$1Finance by Gershon.AI — '),
)
// v2.23.5 — naming: the sign-in callback and 404 page titles live in src/index.tsx
// (95 KB, shared with HOLD PR #19), so they are renamed in the built worker instead.
const workerFile = 'dist/_worker.js'
writeFileSync(
  workerFile,
  readFileSync(workerFile, 'utf8')
    .split('Signing you in · Gershon.AI Finance').join('Signing you in · Finance by Gershon.AI')
    .split('Not found · Gershon.AI Finance').join('Not found · Finance by Gershon.AI'),
)
console.log(`Build timestamp injected: ${timestamp} (v${version})`)
