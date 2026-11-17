// E26-T4 [O12]: renders a ShareCard to a PNG and shares or downloads it.
import type { ShareCard } from '../domain/shareCard'

const WIDTH = 1080
const PAD = 72

/** A design token's value, read from the page (canvas cannot use `var()`). */
function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value === '' ? fallback : value
}

/** Draws the card on a canvas and returns it as an `image/png` Blob. */
export function renderShareCardBlob(card: ShareCard): Promise<Blob> {
  const rows = card.lifts.length + (card.prs.length > 0 ? card.prs.length + 1 : 0)
  const height = 420 + rows * 84 + PAD
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('no canvas'))
  const family = token('--font-sans', 'system-ui, sans-serif')
  const ink = token('--color-text', 'black')
  const quiet = token('--color-muted', 'gray')
  const gold = token('--color-pr', 'goldenrod')
  ctx.fillStyle = token('--color-surface', 'white')
  ctx.fillRect(0, 0, WIDTH, height)
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = quiet
  ctx.font = `500 36px ${family}`
  ctx.fillText(`${card.dateText} · ${card.durationText}`, PAD, PAD + 36)
  ctx.fillStyle = ink
  ctx.font = `700 76px ${family}`
  ctx.fillText(card.name, PAD, PAD + 140)
  let y = PAD + 260
  if (card.prs.length > 0) {
    ctx.fillStyle = gold
    ctx.font = `700 34px ${family}`
    ctx.fillText('PR', PAD, y)
    y += 64
    for (const pr of card.prs) {
      ctx.fillStyle = ink
      ctx.font = `600 40px ${family}`
      ctx.fillText(`${pr.name} · ${pr.kind}`, PAD, y)
      y += 84
    }
    y += 20
  }
  for (const lift of card.lifts) {
    ctx.fillStyle = ink
    ctx.font = `500 40px ${family}`
    ctx.textAlign = 'left'
    ctx.fillText(lift.name, PAD, y)
    ctx.textAlign = 'right'
    ctx.fillText(lift.topSet, WIDTH - PAD, y)
    ctx.textAlign = 'left'
    y += 84
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no image'))), 'image/png')
  })
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Shares the PNG through the share sheet when `navigator.canShare({ files })` accepts it,
 * otherwise downloads it. Resolves 'shared' or 'downloaded'.
 */
export async function shareCardImage(card: ShareCard): Promise<'shared' | 'downloaded'> {
  const blob = await renderShareCardBlob(card)
  const filename = `${card.name.replace(/[^\w-]+/g, '-').toLowerCase()}.png`
  const file = new File([blob], filename, { type: 'image/png' })
  const canShareFile =
    typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  if (canShareFile) {
    await navigator.share({ files: [file], title: card.name })
    return 'shared'
  }
  download(blob, filename)
  return 'downloaded'
}
