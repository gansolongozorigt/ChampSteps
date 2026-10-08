import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // E2E only: proxy /api/* to a deployed backend (Vite dev has no serverless functions).
  // E2E_AI_PROXY (optional) routes /api/ai-insight to the local mock server
  // (tests/e2e/helpers/api-server.mjs); keys are matched in order, so it goes first.
  server: process.env.E2E_API_PROXY
    ? {
        proxy: {
          ...(process.env.E2E_AI_PROXY
            ? { '/api/ai-insight': { target: process.env.E2E_AI_PROXY, changeOrigin: true } }
            : {}),
          '/api': { target: process.env.E2E_API_PROXY, changeOrigin: true },
        },
      }
    : undefined,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
        theme_color: '#1c1917',
        background_color: '#ffffff',
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
      workbox: {
        // ttf keeps the NotoSans fonts (PDF export) in the precache.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,ttf,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
})
