// Renders the four 390x844 crops from index.html.
// Run: NODE_PATH=<a node_modules holding playwright> PW_CHANNEL=msedge node render.cjs
const path = require('path')
const { chromium } = require('playwright')

;(async () => {
  const dir = __dirname
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {})
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } })
  await page.goto('file:///' + path.join(dir, 'index.html').replace(/\\/g, '/'))
  await page.evaluate(() => document.fonts.ready)
  const names = { s01: '01-capture-live', s02: '02-capture-fallback', s03: '03-align', s04: '04-compare' }
  for (const id of Object.keys(names)) {
    const el = await page.$('#' + id)
    await el.screenshot({ path: path.join(dir, names[id] + '.png') })
  }
  await browser.close()
})()
