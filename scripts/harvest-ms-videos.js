// Harvests Muscle & Strength's exercise pages into `ms-pages.json` (`MsPage[]`).
//
// M&S's Cloudflare returns 403 to curl and server-side fetch, so this runs in a real browser:
// open any page on https://www.muscleandstrength.com, paste this file into the DevTools
// console, and wait (~10 minutes for ~600 pages, fetched one at a time, 1 s apart). It then
// downloads `ms-pages.json`; commit it as `scripts/data/ms-pages.json` and run
// `npx tsx scripts/build-videos.ts`.
//
// Each page yields `{ slug, title, equipment, video }`:
// - slug: the `<slug>` of `/exercises/<slug>.html`
// - title: the <title> text before ": Video Exercise Guide"
// - equipment: the profile's "Equipment Required" value, or null
// - video: `{ provider: 'youtube' | 'vimeo', id: string }` for the page's main player, or null.
//   Prefers the iframe inside `.video-wrap` / `.responsive-embed`; falls back to the first
//   youtube/vimeo player iframe anywhere on the page. YouTube ids match `[\w-]{11}`; Vimeo ids
//   are the numeric id from `player.vimeo.com/video/<id>`.
//
// Only these four fields are kept; no M&S text beyond the exercise title is copied.
async function harvestMsVideos({ delayMs = 1000, download = true } = {}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const urls = []
  for (const page of [1, 2]) {
    const xml = await fetch(`/sitemap.xml?page=${page}`).then((r) => r.text())
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(match[1])
  }
  const exerciseUrls = [...new Set(urls.filter((u) => /\/exercises\/[^/]+\.html$/.test(u)))]
  console.log(`[harvest] ${exerciseUrls.length} exercise pages`)

  const parseVideo = (src) => {
    if (!src) return null
    const youtubeId = src.match(/youtube\.com\/embed\/([\w-]{11})/)?.[1]
    if (youtubeId) return { provider: 'youtube', id: youtubeId }
    const vimeoId = src.match(/player\.vimeo\.com\/video\/(\d+)/)?.[1]
    if (vimeoId) return { provider: 'vimeo', id: vimeoId }
    return null
  }

  const pages = []
  const failures = []
  for (const [i, url] of exerciseUrls.entries()) {
    const slug = url.match(/\/exercises\/([^/]+)\.html$/)[1]
    try {
      const response = await fetch(new URL(url).pathname)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html')

      const title = (doc.querySelector('title')?.textContent ?? '')
        .split(': Video Exercise Guide')[0]
        .trim()

      const wrapIframe = doc.querySelector(
        '.video-wrap iframe, .video.responsive-embed iframe, .responsive-embed iframe'
      )
      const fallbackIframe = doc.querySelector(
        'iframe[src*="youtube.com/embed/"], iframe[src*="player.vimeo.com/video/"]'
      )
      const video =
        parseVideo(wrapIframe?.getAttribute('src')) ?? parseVideo(fallbackIframe?.getAttribute('src'))

      const equipmentItem = [...doc.querySelectorAll('li')]
        .map((li) => li.textContent.replace(/\s+/g, ' ').trim())
        .find((text) => /^Equipment Required/i.test(text))
      const equipment = equipmentItem?.replace(/^Equipment Required\s*/i, '').trim() || null

      pages.push({ slug, title, equipment, video })
    } catch (error) {
      failures.push({ slug, error: String(error) })
    }
    if ((i + 1) % 50 === 0) console.log(`[harvest] ${i + 1}/${exerciseUrls.length}`)
    await sleep(delayMs)
  }

  pages.sort((a, b) => a.slug.localeCompare(b.slug))
  console.log(`[harvest] done: ${pages.length} pages, ${failures.length} failed`, failures)
  window.__msPages = pages

  if (download) {
    const blob = new Blob([JSON.stringify(pages, null, 2) + '\n'], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'ms-pages.json'
    link.click()
  }
  return { pages: pages.length, failures }
}

harvestMsVideos()
