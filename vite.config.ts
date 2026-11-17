/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// The app is served from the root of the Cloudflare Worker behind Access (decision 0007
// supersedes 0003's GitHub Pages base path). Get this wrong and the build works on localhost
// and 404s in production.
const base = '/'

// The pose model's wasm (photos v2, decision 0026 L3) is self-hosted from the npm package: served
// from node_modules in dev and copied into dist/mediapipe/wasm/ at build time, never committed.
// It is about 15 MB, so it stays out of the precache (globIgnores) and is cached at runtime.
const MEDIAPIPE_WASM_DIR = 'node_modules/@mediapipe/tasks-vision/wasm'
const MEDIAPIPE_WASM_FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']

function mediapipeWasm(): Plugin {
  let outDir = 'dist'
  let wasmDir = MEDIAPIPE_WASM_DIR
  return {
    name: 'mediapipe-wasm',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      wasmDir = resolve(config.root, MEDIAPIPE_WASM_DIR)
    },
    configureServer(server) {
      server.middlewares.use('/mediapipe/wasm/', (req, res, next) => {
        const name = (req.url ?? '').replace(/^\//, '').split('?')[0]
        if (!MEDIAPIPE_WASM_FILES.includes(name)) return next()
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        createReadStream(join(wasmDir, name)).pipe(res)
      })
    },
    writeBundle() {
      const target = join(outDir, 'mediapipe', 'wasm')
      mkdirSync(target, { recursive: true })
      for (const name of MEDIAPIPE_WASM_FILES) {
        const from = join(wasmDir, name)
        if (existsSync(from)) copyFileSync(from, join(target, name))
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    mediapipeWasm(),
    VitePWA({
      // 'prompt' leaves the choice of when to reload with the user; the UI that asks is
      // E2-T2's job, which is also why nothing is injected into index.html here.
      registerType: 'prompt',
      injectRegister: null,
      // The manifest fetch needs Access's cookie, or Access's own login page comes back
      // instead of JSON and the browser refuses to install the app.
      useCredentials: true,
      workbox: {
        // Workbox's default glob is '**/*.{js,wasm,css,html}' (the icons and the manifest are
        // added by the plugin itself). The bundled exercise photos in public/library-photos/
        // are .jpg, so they are named here too, or they would not work offline.
        globPatterns: ['**/*.{js,wasm,css,html,jpg,woff2}'],
        // The pose model's wasm and loader (photos v2) are far over the 2 MiB precache limit and
        // only needed by people who take progress photos: runtime-cached below instead.
        globIgnores: ['mediapipe/**'],
        // The push and notificationclick listeners live in public/sw-push.js (E24); the
        // generated worker stays generateSW so the precache is unchanged.
        importScripts: ['sw-push.js'],
        // The Worker answers /api/ itself (E7-T1) and Access owns /cdn-cgi/; without this the
        // navigation fallback would answer both from the cached SPA shell instead of letting
        // them reach the Worker.
        navigateFallbackDenylist: [/^\/api\//, /^\/cdn-cgi\//],
        // Non-catalog library exercise photos are never bundled (src/data/photos.ts fetches
        // them from raw.githubusercontent.com instead) — cache them at runtime the first time
        // they are fetched online, so they keep working offline afterwards.
        runtimeCaching: [
          // Progress photos' pose model (photos v2): the self-hosted wasm, then the model file from
          // Google's model bucket. CacheFirst: fetched once online, offline afterwards.
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/mediapipe/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-wasm',
              expiration: { maxEntries: 8 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/storage\.googleapis\.com\/mediapipe-models\/pose_landmarker\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-models',
              expiration: { maxEntries: 2 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'library-photos',
              expiration: { maxEntries: 300 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Workout Tracker',
        short_name: 'Workout',
        description: 'Log a workout from your phone, on or off the gym wifi.',
        display: 'standalone',
        start_url: base,
        scope: base,
        // Matches --color-bg in src/styles/tokens.css, so the iOS splash screen and status
        // bar do not seam against the app's own background on launch. Kept in sync by
        // src/pwa/manifest.test.ts's O5 tests rather than by reading tokens.css at config time.
        theme_color: '#F6F6F3',
        background_color: '#F6F6F3',
        // Relative to the manifest, which the browser fetches from under `base`.
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Form tests that user.type() several fields run past vitest's 5s default when the full
    // suite shares the machine with other agents' runs; the time is load, not a hang.
    testTimeout: 15000,
  },
})
