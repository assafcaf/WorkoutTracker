// [O14] the closed stroked icon set: every icon is one uniform <svg>, and no other inline <svg>
// remains in src/ui outside charts/ and body/.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { Icon, type IconName } from './icons'

const NAMES: IconName[] = [
  'ChevronDown', 'ChevronLeft', 'ChevronRight', 'Check', 'X', 'Plus', 'Minus', 'Trash',
  'Pencil', 'Clock', 'Info', 'History', 'Swap', 'Settings', 'Cloud', 'CloudOff', 'Dumbbell',
  'ChartLine', 'ListChecks', 'LayoutDashboard', 'Calendar', 'TrendingUp', 'ClipboardList', 'Gear',
]

describe('[O14] Icon', () => {
  test.each(NAMES)('%s renders the stroked 24-grid svg attributes', (name) => {
    const { container } = render(<Icon name={name} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg!.getAttribute('fill')).toBe('none')
    expect(svg!.getAttribute('stroke')).toBe('currentColor')
    expect(svg!.getAttribute('stroke-width')).toBe('1.75')
    expect(svg!.getAttribute('stroke-linecap')).toBe('round')
    expect(svg!.getAttribute('stroke-linejoin')).toBe('round')
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
  })

  test.each(NAMES)('%s draws something', (name) => {
    const { container } = render(<Icon name={name} />)
    expect(container.querySelectorAll('svg path, svg circle, svg line, svg rect, svg polyline').length).toBeGreaterThan(0)
  })

  test('the icons are distinct drawings', () => {
    const drawn = NAMES.map((n) => render(<Icon name={n} />).container.innerHTML)
    expect(new Set(drawn).size).toBe(NAMES.length)
  })

  test('size defaults to 20 and can be set', () => {
    const def = render(<Icon name="Check" />).container.querySelector('svg')!
    expect(def.getAttribute('width')).toBe('20')
    expect(def.getAttribute('height')).toBe('20')
    const big = render(<Icon name="Check" size={32} />).container.querySelector('svg')!
    expect(big.getAttribute('width')).toBe('32')
    expect(big.getAttribute('height')).toBe('32')
  })
})

describe('[O14] no inline svg outside the icon set', () => {
  const uiDir = resolve(fileURLToPath(import.meta.url), '..')

  function sourceFiles(dir: string): string[] {
    const found: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'charts' || entry.name === 'body') continue
        found.push(...sourceFiles(full))
      } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
        found.push(full)
      }
    }
    return found
  }

  test('only icons.tsx contains <svg in src/ui outside charts/ and body/', () => {
    const offenders = sourceFiles(uiDir)
      .filter((f) => !f.endsWith(`${sep}icons.tsx`))
      .filter((f) => readFileSync(f, 'utf-8').includes('<svg'))
      .map((f) => f.slice(uiDir.length + 1))
    expect(offenders).toEqual([])
  })
})
