// Screenshots of the real live capture view (LiveView.tsx) in three states, for board.html.
// The app runs unchanged in Vite dev; only its inputs are faked in the page:
//   - the camera: getUserMedia returns a canvas stream of an illustrated room and silhouette,
//   - the level: synthetic `devicemotion` events (iOS-style fused gravity) at a chosen roll,
//   - the pose model: the @mediapipe/tasks-vision module is swapped for a stub that returns the
//     landmarks of the drawn silhouette, so the distance bar measures the drawing,
//   - the reference: one back-camera front photo seeded in IndexedDB (the ghost).
// Run (dev server up on --url): NODE_PATH=<node_modules with playwright> PW_CHANNEL=msedge \
//   node live.cjs [--url http://127.0.0.1:5181/]
const path = require('path')
const { chromium } = require('playwright')

const args = process.argv.slice(2)
const URL = args[args.indexOf('--url') + 1] && args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://127.0.0.1:5173/'
const OUT = path.join(__dirname, 'shots')
const { pathToFileURL } = require('url')
const ROOT = path.join(__dirname, '..', '..', '..', '..', '..')
const SHOOT = path.join(ROOT, 'scripts', 'ux-review', 'shoot.mjs')
const STATE = path.join(ROOT, 'scripts', 'render-states', 'stats-45.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Runs in the page before the app. window.__scene = { s, roll, waist } drives everything.
const INIT = `(() => {
  const PIN = Date.parse('2026-11-17T09:00:00')
  const Real = Date
  const offset = PIN - Real.now()
  let frozen = null
  const now = () => (frozen !== null ? frozen : Real.now() + offset)
  class PinnedDate extends Real {
    constructor(...a) { a.length ? super(...a) : super(now()) }
    static now() { return now() }
  }
  globalThis.Date = PinnedDate
  window.__freeze = () => { frozen = now() }
  // Dev-only: React StrictMode runs useObjectUrl's cleanup once on mount and revokes the ghost's
  // URL (production renders once). Keep object URLs alive so dev shows what production shows.
  URL.revokeObjectURL = () => {}
  window.__scene = { s: 1.1, roll: 0, waist: 0.84 }
  try { localStorage.setItem('photoCamera.front', 'environment') } catch {}

  const W = 600, H = 800
  // The silhouette of scripts/ux-review/shoot.mjs, scaled by s about the frame centre.
  window.__drawBody = (g, angle, waist, s) => {
    g.save()
    g.translate(W / 2, H / 2); g.scale(s, s); g.translate(-W / 2, -H / 2)
    g.translate(W / 2, 0)
    g.fillStyle = angle === 'back' ? '#5b4a40' : '#6e5a4c'
    const shoulder = 125, hip = 92 * waist, mid = 88 * waist
    g.beginPath(); g.ellipse(0, 165, 48, 58, 0, 0, Math.PI * 2); g.fill()
    g.fillRect(-22, 210, 44, 40)
    g.beginPath()
    g.moveTo(-shoulder, 260); g.quadraticCurveTo(0, 235, shoulder, 260)
    g.lineTo(mid + 6, 420); g.lineTo(hip, 500); g.lineTo(hip - 10, 700); g.lineTo(10, 700)
    g.lineTo(0, 540); g.lineTo(-10, 700); g.lineTo(-hip + 10, 700); g.lineTo(-hip, 500)
    g.lineTo(-mid - 6, 420); g.closePath(); g.fill()
    for (const dir of [-1, 1]) {
      g.beginPath(); g.ellipse(dir * (shoulder + 8), 380, 22, 120, dir * -0.08, 0, Math.PI * 2); g.fill()
    }
    g.restore()
  }
  window.__room = (g) => {
    g.fillStyle = '#d9d4cb'; g.fillRect(-100, -100, W + 200, H + 200)
    g.fillStyle = '#b9b2a6'; g.fillRect(-100, 660, W + 200, H)
  }
  // Landmarks of that drawing, normalised, MediaPipe indices.
  window.__landmarks = (s) => {
    const m = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))
    const at = (i, x, y) => { m[i] = { x: 0.5 + ((x - 300) * s) / W, y: 0.5 + ((y - 400) * s) / H, visibility: 1 } }
    at(0, 300, 170); at(11, 190, 262); at(12, 410, 262); at(23, 220, 500); at(24, 380, 500)
    at(27, 245, 690); at(28, 355, 690); at(29, 245, 698); at(30, 355, 698); at(31, 240, 700); at(32, 360, 700)
    return m
  }

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const g = canvas.getContext('2d')
  const paint = () => {
    const sc = window.__scene
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.translate(W / 2, H / 2); g.rotate((-sc.roll * Math.PI) / 180); g.translate(-W / 2, -H / 2)
    window.__room(g)
    window.__drawBody(g, 'front', sc.waist, sc.s)
  }
  setInterval(paint, 33); paint()
  const md = navigator.mediaDevices || {}
  md.getUserMedia = async () => { paint(); return canvas.captureStream(30) }
  md.enumerateDevices = async () => []
  try { Object.defineProperty(navigator, 'mediaDevices', { value: md, configurable: true }) } catch {}

  setInterval(() => {
    const r = (window.__scene.roll * Math.PI) / 180
    const G = 9.81
    // Chromium on a desktop has no DeviceMotionEvent constructor: a plain Event with its fields.
    const e = new Event('devicemotion')
    Object.assign(e, {
      accelerationIncludingGravity: { x: G * Math.sin(r), y: -G * Math.cos(r), z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      interval: 16,
    })
    window.dispatchEvent(e)
  }, 16)
})()`

// Stands in for @mediapipe/tasks-vision: landmarks of the drawn body (live) and of the reference.
const POSE_STUB = `
export const FilesetResolver = { forVisionTasks: async () => ({}) }
export const PoseLandmarker = {
  createFromOptions: async () => ({
    detectForVideo: () => ({ landmarks: window.__scene.s > 0 ? [window.__landmarks(window.__scene.s)] : [] }),
    detect: () => ({ landmarks: [window.__landmarks(1)] }),
    setOptions: async () => {},
    close() {},
  }),
}
export default { FilesetResolver, PoseLandmarker }
`

async function seedReference(page) {
  await page.waitForFunction(() => indexedDB.databases().then((d) => d.some((x) => x.name === 'workout-tracker')))
  await page.evaluate(async () => {
    const W = 600, H = 800
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    const g = c.getContext('2d')
    window.__room(g)
    window.__drawBody(g, 'front', 0.92, 1)
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9))
    const lm = window.__landmarks(1)
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    const d = (a, b) => Math.hypot((a.x - b.x) * W, (a.y - b.y) * H) / H
    const sh = mid(lm[11], lm[12])
    const row = {
      id: 'example-ref-front', day: '2026-10-06', angle: 'front', data: await blob.arrayBuffer(), type: 'image/jpeg',
      width: W, height: H, align: { scale: 1, rotate: 0, dx: 0, dy: 0 }, createdAt: Date.parse('2026-10-06T08:00:00'),
      camera: 'environment', source: 'live', roll: 0, pitch: 0,
      bodyScale: { full: d(sh, mid(lm[27], lm[28])), torso: d(sh, mid(lm[23], lm[24])) },
      bodyLines: { head: 0.15, feet: 0.875 },
    }
    await new Promise((ok, fail) => {
      const req = indexedDB.open('workout-tracker')
      req.onerror = () => fail(req.error)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(['photos'], 'readwrite')
        tx.objectStore('photos').clear()
        tx.objectStore('photos').put(row)
        tx.oncomplete = () => (db.close(), ok())
        tx.onerror = () => fail(tx.error)
      }
    })
  })
}

async function openLive(browser, scene) {
  // shoot.mjs seeds the sessions (so Progress has its Body row); then the fakes go in and reload.
  const { openApp } = await import(pathToFileURL(SHOOT).href)
  const app = await openApp({ state: STATE, viewport: '390x844', dpr: 2, url: URL })
  const { page } = app
  const context = page.context()
  await context.addInitScript(INIT)
  await context.route(/(mediapipe_tasks-vision|tasks-vision\/vision_bundle)/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: POSE_STUB }),
  )
  await page.reload()
  await page.waitForSelector('nav[aria-label="Main"]', { timeout: 20000 })
  await seedReference(page)
  await page.reload()
  await page.waitForSelector('nav[aria-label="Main"]', { timeout: 20000 })
  await page.locator('nav[aria-label="Main"] button', { hasText: /^Progress$/i }).first().click()
  await sleep(500)
  await page.locator('.progress-link-title', { hasText: /^Body$/ }).first().click()
  await sleep(500)
  await page.getByRole('button', { name: 'Add photo' }).click()
  await sleep(500)
  await page.evaluate((sc) => Object.assign(window.__scene, sc), scene)
  await page.getByRole('button', { name: 'Take photo' }).click()
  await page.waitForSelector('.photo-live', { timeout: 10000 })
  return { app, page }
}

const cueIs = (text) => `(() => { const c = document.querySelector('.photo-cue'); return !!c && c.textContent === ${JSON.stringify(text)} })()`

;(async () => {
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {})
  require('fs').mkdirSync(OUT, { recursive: true })

  // (a) 8 % closer than the reference, phone rolled 2.5°: the level speaks first.
  {
    const { app, page } = await openLive(browser, { s: 1.08, roll: 2.5, waist: 0.84 })
    await page.waitForFunction(`(() => { const n = document.querySelector('.photo-distance-number'); return n && n.textContent === '8% closer' })()`, null, { timeout: 15000 })
    await page.waitForFunction(cueIs('Tilt right 2.5°'), null, { timeout: 15000 })
    await page.evaluate(() => window.__freeze())
    await sleep(800)
    await page.screenshot({ path: path.join(OUT, 'a-adjust.png') })
    await app.close()
  }

  // (b) Level, distance inside the zone, the 500 ms dwell still running: "Hold still".
  {
    // No body yet ("Step into frame"), so the distance smoother starts fresh at the new size.
    const { app, page } = await openLive(browser, { s: 0, roll: 0, waist: 0.84 })
    await page.waitForFunction(`!!document.querySelector('.photo-gauge[data-matched="true"]')`, null, { timeout: 15000 })
    await page.waitForFunction(cueIs('Step into frame'), null, { timeout: 15000 })
    await page.evaluate(() => Object.assign(window.__scene, { s: 1.01 }))
    // Freeze the clock the moment the cue turns to "Hold still", so the dwell never completes.
    await page.waitForFunction(
      `(() => { const c = document.querySelector('.photo-cue'); if (c && c.textContent === 'Hold still') { window.__freeze(); return true } return false })()`,
      null,
      { timeout: 15000, polling: 'raf' },
    )
    await sleep(1200)
    await page.screenshot({ path: path.join(OUT, 'b-hold.png') })
    await app.close()
  }

  // (c) Everything in its zone: "Matched", the ghost of the 6 Oct photo over the live body.
  {
    const { app, page } = await openLive(browser, { s: 1.0, roll: 0, waist: 0.84 })
    await page.waitForFunction(cueIs('Matched'), null, { timeout: 15000 })
    await sleep(800)
    await page.screenshot({ path: path.join(OUT, 'c-matched.png') })
    await app.close()
  }
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
