import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadCatalog } from '../../data/catalog'
import { loadLibrary } from '../../data/library'
import { declarationsFor } from '../../test/cssAudit'
import { AlternativesOverlay, type AlternativesOverlayProps } from './AlternativesOverlay'

// D7: the overlay renders what App.tsx's alternatives branch renders today. Real bundled data:
// the catalog's seated-biceps-curls ("Seated biceps curls") is library entry
// Seated_Dumbbell_Curl ("Seated Dumbbell Curl"), and Hammer_Curls ("Hammer Curls") is one of
// its ranked alternatives (hand-checked in src/ui/AlternativesList.test.tsx).

async function props(over: Partial<AlternativesOverlayProps> = {}): Promise<AlternativesOverlayProps> {
  return {
    plannedId: 'seated-biceps-curls',
    catalog: loadCatalog(),
    library: [...(await loadLibrary()).values()],
    gymEquipment: null,
    onPick: vi.fn(),
    onOpenDetail: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
}

/** The ranked row named `name` exactly, read from `.alternatives-row-name`. */
function rowNamed(name: string): HTMLElement {
  const rows = screen.getAllByRole('listitem')
  const found = rows.find(
    (row) => (row.querySelector('.alternatives-row-name')?.textContent ?? '').trim() === name,
  )
  if (!found) throw new Error(`no row named "${name}" was rendered`)
  return found
}

test("D7 AlternativesOverlay is a modal dialog headed with the plan's own exercise name", async () => {
  render(<AlternativesOverlay {...await props()} />)

  const dialog = screen.getByRole('dialog', { name: 'Alternatives to Seated biceps curls' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
})

test('D7 AlternativesOverlay heads a swapped-in library exercise with its library name', async () => {
  render(<AlternativesOverlay {...await props({ plannedId: 'Hammer_Curls' })} />)

  expect(screen.getByRole('dialog', { name: 'Alternatives to Hammer Curls' })).toBeVisible()
})

test('D7 AlternativesOverlay Close calls onClose', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()

  render(<AlternativesOverlay {...await props({ onClose })} />)
  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(onClose).toHaveBeenCalledTimes(1)
})

test('D7 AlternativesOverlay "Do this instead" calls onPick with that alternative\'s id', async () => {
  const user = userEvent.setup()
  const onPick = vi.fn()

  render(<AlternativesOverlay {...await props({ onPick })} />)
  await user.click(within(rowNamed('Hammer Curls')).getByRole('button', { name: 'Do this instead' }))

  expect(onPick).toHaveBeenCalledTimes(1)
  expect(onPick).toHaveBeenCalledWith('Hammer_Curls')
})

test('D7 AlternativesOverlay renders nothing for a plannedId neither catalog nor library has', async () => {
  const { container } = render(<AlternativesOverlay {...await props({ plannedId: 'no-such-exercise' })} />)

  expect(container).toBeEmptyDOMElement()
})

// O24: heading + Close in one fixed top row, rows inset by --space-4.
const uiDir = resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'ui')
const css = (name: string) => readFileSync(join(uiDir, name), 'utf-8')

test('O24 heading and Close share one header row, heading first, Close last', async () => {
  render(<AlternativesOverlay {...await props()} />)

  const heading = screen.getByRole('heading', { name: /Alternatives to/ })
  const close = screen.getByRole('button', { name: 'Close' })
  const row = heading.parentElement as HTMLElement
  expect(row).toBe(close.parentElement)
  expect(row).not.toBe(screen.getByRole('dialog'))
  expect(row.firstElementChild).toBe(heading)
  expect(row.lastElementChild).toBe(close)
})

test('O24 the header row stays at the top while the list scrolls, Close on the right', async () => {
  render(<AlternativesOverlay {...await props()} />)
  const row = screen.getByRole('button', { name: 'Close' }).parentElement as HTMLElement

  const declared = declarationsFor(css('AlternativesOverlay.css'), `.${row.className.split(' ')[0]}`)
  expect(declared.get('position')).toBe('sticky')
  expect(declared.get('top')).toBe('0')
  expect(declared.get('display')).toBe('flex')
  expect(declared.get('justify-content')).toBe('space-between')
})

test('O24 the search box and rows are inset by --space-4 on both sides', () => {
  const declared = declarationsFor(css('AlternativesList.css'), '.alternatives-list')
  const inline = declared.get('padding-inline') ?? declared.get('padding') ?? ''
  const left = declared.get('padding-left') ?? ''
  const right = declared.get('padding-right') ?? ''
  const both =
    inline === 'var(--space-4)' ||
    /^0 var\(--space-4\)/.test(inline) ||
    (left === 'var(--space-4)' && right === 'var(--space-4)')
  expect(both).toBe(true)
})
