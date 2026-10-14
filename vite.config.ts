import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// `vite build --mode native` (npm run cap:sync): the same app for the Capacitor shell, but
// without the service worker / PWA registration (native push + splash replace them).
export default defineConfig(({ mode }) => ({
  // Shown in the user's data export (exportFetch.ts) as appVersion.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // E2E only: proxy /api/* to a deployed backend (Vite dev has no serverless functions).
  // E2E_AI_PROXY (optional) routes /api/ai-insight to the local mock server
  // (tests/e2e/helpers/api-server.mjs); keys are matched in order, so it goes first.
  server: process.env.E2E_API_PROXY
    ? {
        proxy: {
          ...(process.env.E2E_AI_PROXY
            ? {
                '/api/ai-insight': { target: process.env.E2E_AI_PROXY, changeOrigin: true },
                // delete endpoints run locally too (tests/e2e/helpers/api-server.mjs)
                '/api/child': { target: process.env.E2E_AI_PROXY, changeOrigin: true },
                '/api/account': { target: process.env.E2E_AI_PROXY, changeOrigin: true },
              }
            : {}),
          '/api': { target: process.env.E2E_API_PROXY, changeOrigin: true },
        },
      }
    : undefined,
  plugins: [
    react(),
    VitePWA({
      disable: mode === 'native',
      registerType: 'autoUpdate',
      // Custom worker (src/sw.ts): Workbox precache + FCM background messages in ONE file.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Single source of truth for the web app manifest. Do not add a
      // hand-written public/manifest.webmanifest or a manual <link rel="manifest">
      // in index.html — the plugin emits and injects both.
      manifest: {
        name: 'ChampStep',
        short_name: 'ChampStep',
        description: 'Хүүхдийн амжилтыг бүртгэх апп',
        lang: 'mn',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        // Long-press / right-click shortcuts (Android, desktop). iOS ignores them.
        shortcuts: [
          { name: 'Бэлтгэл тэмдэглэх', short_name: 'Өнөөдөр', url: '/today', icons: [{ src: '/shortcut-today.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Амжилт нэмэх', short_name: 'Амжилт', url: '/?action=add-achievement', icons: [{ src: '/shortcut-add.png', sizes: '96x96', type: 'image/png' }] },
        ],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      injectManifest: {
        // ttf keeps the NotoSans fonts (PDF export) in the precache.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,ttf,woff2}'],
        // firebase/messaging + workbox live in the worker bundle
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    })
  ],
}))
