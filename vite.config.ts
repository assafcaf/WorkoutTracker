/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The app is served from a GitHub Pages project site, so every URL it emits has to carry the
// repository name. Get this wrong and the build works on localhost and 404s in production.
const base = '/WorkoutTracker/'

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // 'prompt' leaves the choice of when to reload with the user; the UI that asks is
      // E2-T2's job, which is also why nothing is injected into index.html here.
      registerType: 'prompt',
      injectRegister: null,
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
        theme_color: '#0B0B0F',
        background_color: '#0B0B0F',
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
  },
})
