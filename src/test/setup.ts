// Global test setup, registered as vitest's `setupFiles` in vite.config.ts.
//
// `fake-indexeddb/auto` installs a fake `indexedDB` on globalThis. It must run before any
// module that reads the global at evaluation time — Dexie does exactly that — so the wiring
// lives here rather than in individual test files, where import order would decide it.
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
