// Draws the three PWA icons into public/icons/. Run with `node scripts/generate-icons.mjs`.
//
// The artwork is generated rather than committed as binary someone hand-made, so the shapes,
// the colours and the maskable safe zone are all reviewable as code. It is a plain white "W"
// on the app's theme colour; nothing here needs a drawing library, so there is no dependency.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BACKGROUND = [17, 24, 39] // #111827, the manifest's theme_color
const FOREGROUND = [248, 250, 252] // near-white, so the mark reads at 192 px

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

/**
 * The "W", as four strokes of a unit square: the mark is drawn in 0..1 coordinates and then
 * scaled, so one description serves every size and both safe zones.
 */
const STROKES = [
  [0.08, 0.2, 0.3, 0.8],
  [0.3, 0.8, 0.5, 0.42],
  [0.5, 0.42, 0.7, 0.8],
  [0.7, 0.8, 0.92, 0.2],
]
const STROKE_WIDTH = 0.1

/**
 * `inset` is the fraction of the edge left empty around the mark. A maskable icon may be
 * cropped to a circle inscribed in the centre ~80%, so its mark has to live inside that.
 */
function drawIcon(size, inset) {
  const pixels = Buffer.alloc(size * size * 3)
  for (let i = 0; i < size * size; i++) pixels.set(BACKGROUND, i * 3)

  const span = size * (1 - 2 * inset)
  const origin = size * inset
  const half = (STROKE_WIDTH * span) / 2
  const segments = STROKES.map(([x1, y1, x2, y2]) => [
    origin + x1 * span,
    origin + y1 * span,
    origin + x2 * span,
    origin + y2 * span,
  ])

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const inked = segments.some((s) => distanceToSegment(px, py, s) <= half)
      if (inked) pixels.set(FOREGROUND, (y * size + x) * 3)
    }
  }
  return encodePng(size, pixels)
}

function distanceToSegment(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/** A minimal 8-bit truecolour PNG: IHDR, one deflated IDAT, IEND. */
function encodePng(size, pixels) {
  const stride = size * 3
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter type 0 (None)
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  // bytes 10..12 stay 0: deflate compression, adaptive filtering, no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

mkdirSync(outDir, { recursive: true })
const icons = [
  ['icon-192.png', 192, 0.14],
  ['icon-512.png', 512, 0.14],
  // Maskable: the mark sits inside the centre 80%, the rest is theme colour the launcher may crop.
  ['icon-maskable-512.png', 512, 0.22],
]
for (const [name, size, inset] of icons) {
  writeFileSync(join(outDir, name), drawIcon(size, inset))
  console.log(`wrote icons/${name} (${size}x${size})`)
}
