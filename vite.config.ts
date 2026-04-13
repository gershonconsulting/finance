import pages from '@hono/vite-cloudflare-pages'
import { defineConfig } from 'vite'

function buildTimestampPlugin() {
  return {
    name: 'build-timestamp',
    transformIndexHtml(html: string) {
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
      return html.replace('__BUILD_TIMESTAMP__', timestamp)
    },
  }
}

export default defineConfig({
  plugins: [pages(), buildTimestampPlugin()],
})
