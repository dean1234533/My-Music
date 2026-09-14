// Regenerates public/sitemap.xml from the static public routes. Run as part
// of `npm run build`. The app itself (/app/*) is behind sign-in, so it isn't
// listed here — a signed-out crawler can't reach it anyway.
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SITE_URL = 'https://mymusic.app'

const STATIC_ROUTES = [
  { path: '/', priority: '1.0' },
  { path: '/sign-in', priority: '0.2' },
  { path: '/sign-up', priority: '0.4' },
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC_ROUTES
  .map(
    (u) =>
      `  <url>\n    <loc>${SITE_URL}${u.path}</loc>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml')
await writeFile(outPath, xml)
console.log(`sitemap.xml written with ${STATIC_ROUTES.length} URLs`)
