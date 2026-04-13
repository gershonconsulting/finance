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

const file = 'dist/index.html'
const html = readFileSync(file, 'utf8')
writeFileSync(file, html.replace('__BUILD_TIMESTAMP__', timestamp))
console.log(`Build timestamp injected: ${timestamp}`)
