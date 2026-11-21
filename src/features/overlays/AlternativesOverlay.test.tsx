import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadCatalog } from '../../data/catalog'
import { loadLibrary } from '../../data/library'
import { AlternativesOverlay, type AlternativesOverlayProps } from './AlternativesOverlay'

// D7, DX-08: the swap overlay is the one Exercise picker: "Swap <Plan's name>" and an X in the
// header, search, "My gym only", the ranked stand-ins under "Similar", then "All" in one scroll.
// Real bundled data: the catalog's seated-biceps-curls ("Seated biceps curls") is library entry
// Seated_Dumbbell_Curl, and Hammer_Curls ("Hammer Curls") is one of its ranked alternatives.

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

/** The row names of the section headed `title`. */
function sectionNames(title: string): string[] {
  const section = screen.getByRole('region', { name: title })
  return [...section.querySelectorAll('.picker-row-name')].map((name) => (name.textContent ?? '').trim())
}

test("D7 DX-08 the overlay is a modal dialog titled Swap and the plan's own exercise name", async () => {
  render(<AlternativesOverlay {...await props()} />)

  const dialog = screen.getByRole('dialog', { name: 'Swap Seated biceps curls' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
})

test('D7 a swapped-in library exercise is titled with its library name; a heading prop replaces it', async () => {
  const { unmount } = render(<AlternativesOverlay {...await props({ plannedId: 'Hammer_Curls' })} />)
  expect(screen.getByRole('dialog', { name: 'Swap Hammer Curls' })).toBeVisible()
  unmount()

  render(<AlternativesOverlay {...await props({ heading: 'Replace Seated biceps curls in Workout A' })} />)
  expect(screen.getByRole('dialog', { name: 'Replace Seated biceps curls in Workout A' })).toBeVisible()
})

test('D7 the X calls onClose', async () => {
  const onClose = vi.fn()
  render(<AlternativesOverlay {...await props({ onClose })} />)

  const close = screen.getByRole('button', { name: 'Close' })
  expect(close).toHaveClass('icon-btn')
  expect(close.querySelector('svg')).not.toBeNull()
  await userEvent.click(close)

  expect(onClose).toHaveBeenCalledTimes(1)
})

test('DX-08 the whole row is the target: tapping it picks that alternative, no "Do this instead"', async () => {
  const user = userEvent.setup()
  const onPick = vi.fn()
  render(<AlternativesOverlay {...await props({ onPick })} />)

  expect(screen.queryByRole('button', { name: /instead/ })).toBeNull()
  await user.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'Hammer Curls')
  await user.click(screen.getAllByRole('button', { name: 'Hammer Curls' })[0])

  expect(onPick).toHaveBeenCalledWith('Hammer_Curls')
})

test('D7 the overlay renders nothing for a plannedId neither catalog nor library has', async () => {
  const { container } = render(<AlternativesOverlay {...await props({ plannedId: 'no-such-exercise' })} />)

  expect(container).toBeEmptyDOMElement()
})

test('DX-08 Similar lists at most 6, the logged Hyper-extension first, then All carries the rest, no pager', async () => {
  render(<AlternativesOverlay {...await props({ plannedId: 'deadlift', loggedIds: ['deadlift', 'hyper-extension'] })} />)

  const similar = sectionNames('Similar')
  expect(similar.length).toBeLessThanOrEqual(6)
  expect(similar[0]).toBe('Hyper-extension')
  expect(similar.join(' ')).not.toMatch(/band|chain/i)
  expect(similar).toContain('Deficit Deadlift')
  // Every other Exercise, in one continuous list after it; nothing repeats.
  const all = sectionNames('All')
  expect(all.length).toBeGreaterThan(500)
  expect(all).toContain('Deadlift with Chains')
  expect(all.filter((name) => similar.includes(name))).toEqual([])
  expect(screen.queryByText(/Page \d+ of \d+/)).toBeNull()
  expect(screen.queryByRole('button', { name: /^Show all|Next|Previous/ })).toBeNull()
})

test("DX-08 My gym only is on by default and filters by the gym's equipment; off, it shows all", async () => {
  const user = userEvent.setup()
  render(<AlternativesOverlay {...await props({ plannedId: 'deadlift', gymEquipment: ['barbell'] })} />)

  const chip = screen.getByRole('button', { name: 'My gym only' })
  expect(chip).toHaveAttribute('aria-pressed', 'true')
  expect(sectionNames('Similar')).not.toContain('Hyperextensions (Back Extensions)')
  expect(sectionNames('All')).not.toContain('Dumbbell Bench Press')
  await user.click(chip)
  expect(sectionNames('All')).toContain('Dumbbell Bench Press')
})

test('V6-10 choosing a logged lift swaps to the lifter’s own Exercise, the one with the history', async () => {
  const onPick = vi.fn()
  render(<AlternativesOverlay {...await props({ plannedId: 'deadlift', loggedIds: ['hyper-extension'], onPick })} />)

  const similar = screen.getByRole('region', { name: 'Similar' })
  await userEvent.click(within(similar).getByRole('button', { name: 'Hyper-extension' }))

  expect(onPick).toHaveBeenCalledWith('hyper-extension')
})

test('V6-10 a lift already in today’s Workout is not offered as a swap', async () => {
  render(
    <AlternativesOverlay
      {...await props({ plannedId: 'deadlift', loggedIds: ['hyper-extension'], taken: ['deadlift', 'hyper-extension'] })}
    />,
  )

  const names = [...sectionNames('Similar'), ...sectionNames('All')]
  expect(names).not.toContain('Hyper-extension')
  expect(names).not.toContain('Hyperextensions (Back Extensions)')
  expect(names).toContain('Deficit Deadlift')
})

test('DX-08 a row shows its muscle in grey and its last Set inline, with no coloured dot', async () => {
  render(
    <AlternativesOverlay
      {...await props({ plannedId: 'deadlift', loggedIds: ['hyper-extension'], lastSets: new Map([['hyper-extension', '20 × 12 · 14 Oct']]) })}
    />,
  )

  const row = within(screen.getByRole('region', { name: 'Similar' })).getByRole('button', { name: 'Hyper-extension' })
  expect(row).toHaveAccessibleDescription(/20 × 12 · 14 Oct/)
  expect(row.querySelector('.muscle-dot')).toBeNull()
  expect(row.querySelector('.picker-row-meta')?.textContent).toMatch(/^lower back · 20 × 12 · 14 Oct$/)
})
