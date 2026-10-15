// Renders one screen of the app to a PNG: the `web-ui` surface's Render command (PAD 0.4,
// .claude/workflow/bin/render-check.sh). Run through scripts/render-route.sh.
//
//   node scripts/render-route.mjs <route> <width> <height> <out.png> [state.json]
//
// It brings up everything it renders itself: a Vite dev server on a free port (its own dep
// cache, so several renders can run at once) and a headless Chrome with a throwaway profile,
// driven over the DevTools protocol with `ws`. Both are shut down on success and on failure.
//
// The app has no URL routes -- the shell switches tabs in React state -- so <route> names a
// screen and the renderer clicks its way there. Syntax:
//
//   <route> := /<screen>[|<tap>]...
//
// <screen> is one of the legacy names below, or the visible label of a bottom-bar tab
// (case-insensitive, e.g. /progress, /train, /sessions), which taps that tab:
//   /  or /dashboard   the Dashboard (where the app launches)
//   /sessions          the Sessions tab
//   /lifts             the Lifts tab
//   /program           the Program tab
//   /exercises         the Program tab's Exercises side
//   /settings          Settings, from the Dashboard's gear
// Each `|<tap>` then taps the control whose visible text (or aria-label) is exactly <tap>,
// falling back to the first control whose text contains it. The route is one shell argument
// (it may hold spaces and `|`), so quote it:
//   bash scripts/render-route.sh '/progress|Back squat|3M' 390 844 out.png scripts/render-states/stats-45.json
//
// [state.json], when given and non-empty, is seeded into the app's IndexedDB
// (`workout-tracker`: `sessions` and `settings`) before the route is shown. Its shape is
// `{ "sessions": Session[], "settings": { <setting key>: <value> } }` -- a backup file's
// sessions and settings (src/storage/backup.ts). Without it the render is a fresh install.
// Optional keys: `now` (an ISO instant with offset; the page's clock starts there and keeps
// running), `timezone` (an IANA zone for the page) and `dpr` (device scale factor, default 1;
// the stats states use 2). The stats states come from scripts/stats-fixture/build.mjs:
// stats-45 (all 45 Sessions), stats-1 and stats-3 (the sparse cuts).
//
// Chrome is found at $CHROME, else at the usual install path for the platform.

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import WebSocket from 'ws'

const ROUTES = {
  '/': [],
  '/dashboard': [],
  '/sessions': ['nav[aria-label="Main"] button[aria-label="Sessions"]'],
  '/lifts': ['nav[aria-label="Main"] button[aria-label="Lifts"]'],
  '/program': ['nav[aria-label="Main"] button[aria-label="Program"]'],
  '/exercises': ['nav[aria-label="Main"] button[aria-label="Program"]', 'text:Exercises'],
  '/settings': ['button[aria-label="Settings"]'],
}
const TOTAL_TIMEOUT_MS = 120_000

const [routeArg, widthArg, heightArg, outArg, stateArg = ''] = process.argv.slice(2)
const [screenPart, ...taps] = (routeArg ?? '').split('|').map((t) => t.trim())
const route = screenPart.replace(/\/+$/, '') || '/'
const width = Number(widthArg)
const height = Number(heightArg)
if (!/^\//.test(route) || taps.some((t) => !t) || !(width > 0) || !(height > 0) || !outArg) {
  console.error(`usage: render-route.mjs <route> <width> <height> <out.png> [state.json]\n  routes: ${Object.keys(ROUTES).join(' ')} or /<tab label>, then |<tap by visible text> ...`)
  process.exit(64)
}
const out = resolve(outArg)
const state = stateArg.trim() ? JSON.parse(readFileSync(resolve(stateArg), 'utf8')) : null

const log = (...a) => console.error('[render]', ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const scratch = mkdtempSync(join(tmpdir(), 'render-route-'))
let vite = null
let chrome = null
let cdpSocket = null

async function cleanup() {
  try {
    if (cdpSocket && cdpSocket.readyState === WebSocket.OPEN) cdpSocket.close()
  } catch {}
  if (chrome && chrome.exitCode === null) {
    chrome.kill()
    await Promise.race([new Promise((r) => chrome.once('exit', r)), sleep(5000)])
  }
  if (vite) {
    try {
      await vite.close()
    } catch {}
  }
  for (let i = 0; i < 5; i++) {
    try {
      rmSync(scratch, { recursive: true, force: true })
      break
    } catch {
      await sleep(500)
    }
  }
}

function freePort() {
  return new Promise((res, rej) => {
    const srv = createNetServer()
    srv.unref()
    srv.on('error', rej)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => res(port))
    })
  })
}

function findChrome() {
  const candidates = [
    process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error('no Chrome found; set CHROME to its executable')
  return found
}

async function startVite() {
  const { createServer } = await import('vite')
  for (let attempt = 0; attempt < 5; attempt++) {
    const port = await freePort()
    if (port === 5173) continue
    const server = await createServer({
      root: process.cwd(),
      configFile: resolve('vite.config.ts'),
      cacheDir: join(scratch, 'vite-cache'),
      logLevel: 'warn',
      clearScreen: false,
      server: { port, strictPort: true, host: '127.0.0.1', hmr: false, fs: { strict: false } },
    })
    try {
      await server.listen()
      return { server, url: `http://127.0.0.1:${port}/` }
    } catch (e) {
      await server.close().catch(() => {})
      if (attempt === 4) throw e
    }
  }
  throw new Error('no free port for Vite')
}

async function startChrome(exe) {
  const profile = join(scratch, 'chrome-profile')
  mkdirSync(profile, { recursive: true })
  const proc = spawn(
    exe,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--hide-scrollbars',
      '--mute-audio',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  const portFile = join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 300; i++) {
    if (proc.exitCode !== null) throw new Error(`Chrome exited early (${proc.exitCode})`)
    if (existsSync(portFile)) {
      const [port] = readFileSync(portFile, 'utf8').split(/\r?\n/)
      if (port) return { proc, port: Number(port) }
    }
    await sleep(100)
  }
  throw new Error('Chrome did not open its DevTools port')
}

function connect(wsUrl) {
  return new Promise((res, rej) => {
    const socket = new WebSocket(wsUrl, { perMessageDeflate: false })
    let id = 0
    const pending = new Map()
    const listeners = new Set()
    socket.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.id && pending.has(msg.id)) {
        const { ok, fail } = pending.get(msg.id)
        pending.delete(msg.id)
        msg.error ? fail(new Error(`${msg.error.message} ${msg.error.data ?? ''}`)) : ok(msg.result)
      } else if (msg.method) {
        for (const l of listeners) l(msg)
      }
    })
    socket.on('open', () =>
      res({
        socket,
        send: (method, params = {}) =>
          new Promise((ok, fail) => {
            const n = ++id
            pending.set(n, { ok, fail })
            socket.send(JSON.stringify({ id: n, method, params }))
          }),
        once: (method) =>
          new Promise((ok) => {
            const l = (msg) => {
              if (msg.method === method) {
                listeners.delete(l)
                ok(msg.params)
              }
            }
            listeners.add(l)
          }),
      }),
    )
    socket.on('error', rej)
  })
}

// An expression that finds the element a step taps: `tab:<label>` is a bottom-bar tab,
// `text:<t>` a control by its visible text or aria-label (exact match first, then contains),
// anything else a CSS selector.
function finderFor(step) {
  if (step.startsWith('tab:')) {
    const want = JSON.stringify(step.slice(4).toLowerCase())
    return `[...document.querySelectorAll('nav[aria-label="Main"] button')].find((e) => [e.getAttribute('aria-label'), e.textContent].some((t) => (t ?? '').trim().toLowerCase() === ${want}))`
  }
  if (step.startsWith('text:')) {
    const want = JSON.stringify(step.slice(5))
    const names = `(e) => [e.getAttribute('aria-label'), e.textContent.replace(/\\s+/g, ' ').trim()]`
    const all = `[...document.querySelectorAll('button, label, summary, a, [role="tab"], [role="button"]')]`
    return `(${all}.find((e) => (${names})(e).includes(${want})) ?? ${all}.find((e) => (${names})(e).some((x) => x && x.includes(${want}))))`
  }
  return `document.querySelector(${JSON.stringify(step)})`
}

async function main() {
  const exe = findChrome()
  const [viteUp, chromeUp] = await Promise.all([startVite(), startChrome(exe)])
  vite = viteUp.server
  chrome = chromeUp.proc
  log('vite at', viteUp.url)

  const target = await (await fetch(`http://127.0.0.1:${chromeUp.port}/json/new?about:blank`, { method: 'PUT' })).json()
  const cdp = await connect(target.webSocketDebuggerUrl)
  cdpSocket = cdp.socket
  const evaluate = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(`page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`)
    return r.result.value
  }
  const waitFor = async (expression, what, ms = 60_000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await evaluate(expression).catch(() => false)) return
      await sleep(150)
    }
    throw new Error(`timed out waiting for ${what}`)
  }
  const load = async (reload) => {
    const loaded = cdp.once('Page.loadEventFired')
    await (reload ? cdp.send('Page.reload', { ignoreCache: true }) : cdp.send('Page.navigate', { url: viteUp.url }))
    await loaded
    // The shell is up once its tab bar, a header or the Settings gear has rendered.
    await waitFor(`!!document.querySelector('nav[aria-label="Main"], .app-shell, header')`, 'the app shell')
  }

  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: Number(state?.dpr) || 1, mobile: true })
  if (state?.timezone) await cdp.send('Emulation.setTimezoneOverride', { timezoneId: state.timezone })
  if (state?.now) {
    // Start the page's clock at `now` and let it run: the app sees the pinned day, timers still work.
    const at = Date.parse(state.now)
    if (Number.isNaN(at)) throw new Error(`state.now is not a date: ${state.now}`)
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        const Real = Date, offset = ${at} - Real.now()
        class PinnedDate extends Real {
          constructor(...a) { a.length ? super(...a) : super(Real.now() + offset) }
          static now() { return Real.now() + offset }
        }
        globalThis.Date = PinnedDate
      })()`,
    })
  }
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  await load(false)

  if (state) {
    // The app has opened (and created) its database by now; write the state into it, then
    // reload so every screen reads it from storage as on a real device.
    const sessions = (state.sessions ?? []).map((s) => ({ ...s, updatedAt: s.updatedAt ?? s.finishedAt ?? s.startedAt }))
    const now = Date.now()
    const settings = Object.entries(state.settings ?? {}).map(([key, value]) => ({ key, value, updatedAt: now }))
    await waitFor(
      `indexedDB.databases ? indexedDB.databases().then((d) => d.some((x) => x.name === 'workout-tracker')) : true`,
      'the app database',
    )
    const written = await evaluate(`new Promise((ok, fail) => {
      const req = indexedDB.open('workout-tracker')
      req.onerror = () => fail(req.error)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(['sessions', 'settings'], 'readwrite')
        const sessions = tx.objectStore('sessions'), settings = tx.objectStore('settings')
        sessions.clear(); settings.clear()
        for (const s of ${JSON.stringify(sessions)}) sessions.put(s)
        for (const s of ${JSON.stringify(settings)}) settings.put(s)
        tx.oncomplete = () => { db.close(); ok(${sessions.length}) }
        tx.onerror = () => fail(tx.error)
      }
    })`)
    log(`seeded ${written} sessions, ${settings.length} settings`)
    await load(true)
  }

  const screenSteps = ROUTES[route] ?? [`tab:${route.slice(1)}`]
  for (const step of [...screenSteps, ...taps.map((t) => `text:${t}`)]) {
    const finder = finderFor(step)
    await waitFor(`!!(${finder})`, step, 20_000)
    await evaluate(`(${finder}).click(), true`)
    await sleep(300)
  }

  // Settle: fonts, images, then a couple of quiet frames for charts and transitions.
  await evaluate(`document.fonts ? document.fonts.ready.then(() => true) : true`)
  await waitFor(`[...document.images].every((i) => i.complete)`, 'images', 15_000).catch(() => log('some images never loaded'))
  await sleep(800)
  await evaluate(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`)

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, Buffer.from(shot.data, 'base64'))
  if (!(statSync(out).size > 0)) throw new Error('empty screenshot')
  await cdp.send('Browser.close').catch(() => {})
  log('wrote', out)
}

let code = 0
const timer = setTimeout(() => {
  log(`timed out after ${TOTAL_TIMEOUT_MS / 1000}s`)
  cleanup().finally(() => process.exit(1))
}, TOTAL_TIMEOUT_MS)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => cleanup().finally(() => process.exit(130)))
try {
  await main()
} catch (e) {
  log('failed:', e?.stack ?? e)
  code = 1
} finally {
  clearTimeout(timer)
  await cleanup()
}
process.exit(code)
