// Renders board.html to board.png at 2x. Run live.cjs first (it makes shots/).
// Run: NODE_PATH=<node_modules with playwright> PW_CHANNEL=msedge node render.cjs
const path = require('path')
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {})
  const page = await browser.newPage({ viewport: { width: 700, height: 1000 }, deviceScaleFactor: 2 })
  await page.goto('file:///' + path.join(__dirname, 'board.html').replace(/\\/g, '/'))
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
  await (await page.$('#board')).screenshot({ path: path.join(__dirname, 'board.png') })
  await browser.close()
})()
