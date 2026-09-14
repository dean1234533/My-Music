import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered manually in src/main.tsx instead: the auto-injected
      // registerSW.js registers the worker but never reloads an already-open
      // tab once a new one takes control, so users could keep running a
      // stale bundle indefinitely after a deploy despite skipWaiting()/
      // clientsClaim() in sw-src/sw.ts already handing it control.
      injectRegister: false,
      strategies: 'injectManifest',
      srcDir: 'sw-src',
      filename: 'sw.ts',
      injectManifest: {
        // The custom SW imports the Firebase SDK, which pulls in more than
        // Workbox's default glob-based precache warning threshold expects.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'My Music — Personal Music Library',
        short_name: 'My Music',
        description: 'A personal music library and player powered by YouTube.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#050607',
        theme_color: '#050607',
        orientation: 'portrait-primary',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Runtime image caching + Firebase Messaging background handling both
      // live in sw-src/sw.ts now (injectManifest gives us a real, editable
      // service worker instead of the auto-generated one `workbox:` configures).
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
