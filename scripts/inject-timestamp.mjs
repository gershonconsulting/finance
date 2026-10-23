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
writeFileSync(file, html)
console.log(`Build timestamp injected: ${timestamp} (v${version})`)
