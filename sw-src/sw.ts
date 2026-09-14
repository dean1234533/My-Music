/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope

// Without these, a new deploy installs but stays "waiting" until every open
// tab is fully closed, so users keep getting the stale cached app shell.
self.skipWaiting()
clientsClaim()

// Navigation requests (the document itself) go network-first, registered
// ahead of precacheAndRoute so it wins the route match. Precaching the
// document is otherwise a trap: the cached Response carries whatever HTTP
// headers (CSP, etc.) were live at the moment it was captured, and nothing
// about a headers-only deploy (e.g. editing public/_headers) changes any
// precached asset's content hash — so the service worker never has a
// reason to reinstall and refetch, and a stale document (with stale
// headers) can keep being served indefinitely. Falls back to the cache
// only when actually offline.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'pages' }),
)

// App-shell precaching, generated at build time by vite-plugin-pwa (injectManifest).
precacheAndRoute(self.__WB_MANIFEST)

// Same-origin only: matching by extension alone would also catch a different
// origin's URLs (e.g. Firebase Storage/YouTube thumbnails) whose pathname
// happens to end in .jpg/.png/etc. Restricting to the app's own origin
// limits this cache to bundled/public assets (icons, static artwork served
// through this origin).
registerRoute(
  ({ url }) => url.origin === self.location.origin && /\.(?:png|jpg|jpeg|webp)$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)
