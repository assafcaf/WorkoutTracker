// UX-review helper: opens the running app in headless Chromium (Playwright), optionally seeds
// IndexedDB from a state JSON (same shape as scripts/render-states/*.json, see
// scripts/render-route.mjs), runs a list of steps, and saves screenshots.
//
// Needs a dev server already running (default http://127.0.0.1:5173, override with --url).
//
// CLI:
//   node scripts/ux-review/shoot.mjs [options] <step>...
//
// Options:
//   --state <file.json>   seed `sessions` + `settings` (and pin the clock to its `now`)
//   --viewport 390x844    CSS viewport (default 390x844)
//   --dpr 1               device scale factor (default 1)
//   --font 200%           root font size (simulates large text; e.g. 200%)
//   --reduced-motion      emulate prefers-reduced-motion: reduce
//   --now <ISO>           pin the clock (overrides the state's `now`)
//   --url <url>           app URL (default http://127.0.0.1:5173/)
//   --out <file.png>      final screenshot (same as a trailing `shot:<file>` step)
//   --full                full-page screenshots
//
// Steps (run in order):
//   tab:<label>           tap a bottom-bar tab (Train, Progress, Sessions, Program)
//   tap:<text>            tap the first button/link/label whose aria-label or text equals
//                         <text>, else contains it (visible elements only)
//   tapn:<n>:<text>       like tap:, but the n-th (0-based) match
//   sel:<css>             tap the first element matching a CSS selector
//   type:<css>=<text>     fill an input/textarea
//   key:<key>             press a key (e.g. Enter, Tab)
//   scroll:<css>          scroll that element into view
//   scrolly:<px>          scroll the main scroller/window by px
//   wait:<ms>             wait
//   reload                reload the page (IndexedDB persists)
//   offline / online      toggle network emulation
//   eval:<js>             run JS in the page, print its result
//   shot:<file.png>       save a screenshot now
//
// Example:
//   node scripts/ux-review/shoot.mjs --state scripts/render-states/stats-45.json \
//     'tap:Start' wait:500 shot:/tmp/set.png 'tap:Log set' shot:/tmp/rest.png
//
// Library use: `import { openApp } from './shoot.mjs'` -> { page, run(steps), shot(file), close() }.

import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function openApp({
  state = null,
  viewport = '390x844',
  dpr = 1,
  font = null,
  reducedMotion = false,
  now = null,
  url = 'http://127.0.0.1:5173/',
  full = false,
} = {}) {
  const st = typeof state === 'string' ? JSON.parse(readFileSync(resolve(state), 'utf8')) : state
  const [width, height] = viewport.split('x').map(Number)
  // PW_CHANNEL (e.g. msedge, chrome) uses an installed browser when Playwright's own is absent.
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {})
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: Number(dpr) || 1,
    isMobile: true,
    hasTouch: true,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    timezoneId: st?.timezone,
  })
  const pin = now ?? st?.now
  if (pin) {
    const at = Date.parse(pin)
    await context.addInitScript(`(() => {
      const Real = Date, offset = ${at} - Real.now()
      class PinnedDate extends Real {
        constructor(...a) { a.length ? super(...a) : super(Real.now() + offset) }
        static now() { return Real.now() + offset }
      }
      globalThis.Date = PinnedDate
    })()`)
  }
  if (font) {
    await context.addInitScript(`document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.fontSize = ${JSON.stringify(font)} })`)
  }
  const page = await context.newPage()
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  await page.goto(url)
  await page.waitForSelector('nav[aria-label="Main"], header, main', { timeout: 20000 })
  if (st) {
    const sessions = (st.sessions ?? []).map((s) => ({ ...s, updatedAt: s.updatedAt ?? s.finishedAt ?? s.startedAt }))
    const t = Date.now()
    const settings = Object.entries(st.settings ?? {}).map(([key, value]) => ({ key, value, updatedAt: t }))
    await page.waitForFunction(() => indexedDB.databases().then((d) => d.some((x) => x.name === 'workout-tracker')))
    await page.evaluate(
      ({ sessions, settings }) =>
        new Promise((ok, fail) => {
          const req = indexedDB.open('workout-tracker')
          req.onerror = () => fail(req.error)
          req.onsuccess = () => {
            const db = req.result
            const tx = db.transaction(['sessions', 'settings'], 'readwrite')
            tx.objectStore('sessions').clear()
            tx.objectStore('settings').clear()
            for (const s of sessions) tx.objectStore('sessions').put(s)
            for (const s of settings) tx.objectStore('settings').put(s)
            tx.oncomplete = () => (db.close(), ok())
            tx.onerror = () => fail(tx.error)
          }
        }),
      { sessions, settings },
    )
    await page.reload()
    await page.waitForSelector('nav[aria-label="Main"], header, main', { timeout: 20000 })
  }
  await sleep(600)

  const findClickable = async (text, n = 0) => {
    const handle = await page.evaluateHandle(
      ({ text, n }) => {
        const vis = (e) => {
          const r = e.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'
        }
        const all = [...document.querySelectorAll('button, a, label, summary, [role="button"], [role="tab"], [role="radio"], [role="switch"], [role="option"], input[type="checkbox"]')].filter(vis)
        const names = (e) => [e.getAttribute('aria-label'), e.textContent.replace(/\s+/g, ' ').trim()]
        const exact = all.filter((e) => names(e).includes(text))
        const loose = all.filter((e) => names(e).some((x) => x && x.includes(text)))
        return (exact.length > n ? exact : loose)[n] ?? null
      },
      { text, n },
    )
    const el = handle.asElement()
    if (!el) throw new Error(`no control matching "${text}" (#${n})`)
    return el
  }

  const shot = async (file) => {
    const out = resolve(file)
    mkdirSync(dirname(out), { recursive: true })
    await sleep(250)
    await page.screenshot({ path: out, fullPage: full })
    console.error('[shot]', out)
  }

  const run = async (steps) => {
    for (const step of steps) {
      const i = step.indexOf(':')
      const [op, arg] = i < 0 ? [step, ''] : [step.slice(0, i), step.slice(i + 1)]
      if (op === 'tab') await page.locator(`nav[aria-label="Main"] button`, { hasText: new RegExp(`^${arg}$`, 'i') }).first().click().catch(async () => (await page.$(`nav[aria-label="Main"] button[aria-label="${arg}"]`)).click())
      else if (op === 'tap') await (await findClickable(arg)).click()
      else if (op === 'tapn') {
        const j = arg.indexOf(':')
        await (await findClickable(arg.slice(j + 1), Number(arg.slice(0, j)))).click()
      } else if (op === 'sel') await page.locator(arg).first().click()
      else if (op === 'type') {
        const j = arg.indexOf('=')
        await page.locator(arg.slice(0, j)).first().fill(arg.slice(j + 1))
      } else if (op === 'key') await page.keyboard.press(arg)
      else if (op === 'scroll') await page.locator(arg).first().scrollIntoViewIfNeeded()
      else if (op === 'scrolly') await page.mouse.wheel(0, Number(arg))
      else if (op === 'wait') await sleep(Number(arg))
      else if (op === 'reload') {
        await page.reload()
        await page.waitForSelector('nav[aria-label="Main"], header, main', { timeout: 20000 })
      } else if (op === 'offline') await page.context().setOffline(true)
      else if (op === 'online') await page.context().setOffline(false)
      else if (op === 'eval') console.log(JSON.stringify(await page.evaluate(arg)))
      else if (op === 'shot') await shot(arg)
      else throw new Error(`unknown step ${step}`)
      if (op !== 'wait' && op !== 'shot') await sleep(300)
    }
  }

  return { page, browser, run, shot, close: () => browser.close() }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const opts = {}
  const steps = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--reduced-motion') opts.reducedMotion = true
    else if (a === '--full') opts.full = true
    else if (a.startsWith('--')) opts[a.slice(2)] = args[++i]
    else steps.push(a)
  }
  if (opts.out) steps.push(`shot:${opts.out}`)
  if (!steps.length) {
    console.error('usage: node scripts/ux-review/shoot.mjs [--state f.json] [--viewport WxH] [--dpr n] [--font 200%] [--reduced-motion] [--out f.png] <step>...')
    process.exit(64)
  }
  const app = await openApp(opts)
  let code = 0
  try {
    await app.run(steps)
  } catch (e) {
    console.error('[shoot] failed:', e.message)
    await app.shot(join(tmpdir(), 'shoot-failure.png')).catch(() => {})
    code = 1
  } finally {
    await app.close()
  }
  process.exit(code)
}
