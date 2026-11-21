import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ExercisePicker } from './ExercisePicker'
import type { LibraryExercise } from '../types'

// E19-T13 O23: the Session's picker, a forgiving search over the library.

function entry(id: string, name: string): LibraryExercise {
  return {
    id,
    name,
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: null,
    primaryMuscles: [],
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
  }
}

const LIBRARY: LibraryExercise[] = [
  entry('Dumbbell_Bench_Press', 'Dumbbell Bench Press'),
  entry('Barbell_Curl', 'Barbell Curl'),
  entry('Goblet_Squat', 'Goblet Squat'),
]

test('O23 the picker lists every library Exercise and picks one by tapping its row', async () => {
  const onPick = vi.fn()
  const user = userEvent.setup()
  render(<ExercisePicker library={LIBRARY} taken={[]} onPick={onPick} onClose={vi.fn()} />)

  expect(
    screen.getAllByRole('button', { name: /Barbell Curl|Goblet Squat|Dumbbell Bench Press/ }),
  ).toHaveLength(3)
  await user.click(screen.getByRole('button', { name: 'Goblet Squat' }))

  expect(onPick).toHaveBeenCalledWith('Goblet_Squat')
})

test('O23 the picker search is forgiving: bech press finds Dumbbell Bench Press', async () => {
  const user = userEvent.setup()
  render(<ExercisePicker library={LIBRARY} taken={[]} onPick={vi.fn()} onClose={vi.fn()} />)

  await user.type(screen.getByRole('searchbox', { name: /search/i }), 'bech press')

  expect(screen.getByRole('button', { name: 'Dumbbell Bench Press' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Goblet Squat' })).toBeNull()
})

test('O23 an Exercise already in the Session is not offered again', () => {
  render(
    <ExercisePicker library={LIBRARY} taken={['Goblet_Squat']} onPick={vi.fn()} onClose={vi.fn()} />,
  )

  expect(screen.queryByRole('button', { name: 'Goblet Squat' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Barbell Curl' })).toBeVisible()
})

test('O23 Close leaves the picker without picking', async () => {
  const onPick = vi.fn()
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(<ExercisePicker library={LIBRARY} taken={[]} onPick={onPick} onClose={onClose} />)

  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onPick).not.toHaveBeenCalled()
})

// --- DX-08: one picker everywhere -----------------------------------------------------------

function many(count: number): LibraryExercise[] {
  return Array.from({ length: count }, (_, index) => ({
    ...entry(`Lift_${String(index).padStart(3, '0')}`, `Lift ${String(index).padStart(3, '0')}`),
    primaryMuscles: ['chest' as const],
  }))
}

test('DX-08 the sheet header holds the title and an X; nothing else is a button but the rows and the chip', () => {
  render(
    <ExercisePicker
      title="Add to Workout A"
      library={LIBRARY}
      taken={[]}
      gymEquipment={null}
      onPick={vi.fn()}
      onClose={vi.fn()}
    />,
  )

  const dialog = screen.getByRole('dialog', { name: 'Add to Workout A' })
  const close = within(dialog).getByRole('button', { name: 'Close' })
  expect(close).toHaveClass('icon-btn')
  expect(close.parentElement).toBe(within(dialog).getByRole('heading', { name: 'Add to Workout A' }).parentElement)
  const names = within(dialog)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent)
  expect(names).toEqual(['Close', 'My gym only', 'Barbell Curl', 'Dumbbell Bench Press', 'Goblet Squat'])
})

test('DX-08 a row is its name, then the muscle in grey and the last Set; no coloured dot', () => {
  const library = [{ ...entry('Barbell_Curl', 'Barbell Curl'), primaryMuscles: ['biceps' as const] }]
  render(
    <ExercisePicker
      library={library}
      taken={[]}
      lastSets={new Map([['Barbell_Curl', '30 × 10 · 14 Oct']])}
      onPick={vi.fn()}
      onClose={vi.fn()}
    />,
  )

  const row = screen.getByRole('button', { name: 'Barbell Curl' })
  expect(row).toHaveAccessibleDescription('biceps · 30 × 10 · 14 Oct')
  expect(row.querySelector('.muscle-dot, [data-family]')).toBeNull()
})

test('DX-08 Similar leads when swapping, then All, as one list', () => {
  render(
    <ExercisePicker
      title="Swap Barbell Curl"
      library={LIBRARY}
      similar={[LIBRARY[2]]}
      taken={[]}
      onPick={vi.fn()}
      onClose={vi.fn()}
    />,
  )

  const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
  expect(headings).toEqual(['Similar', 'All'])
  const similar = within(screen.getByRole('region', { name: 'Similar' })).getAllByRole('button')
  expect(similar.map((button) => button.textContent)).toEqual(['Goblet Squat'])
  expect(within(screen.getByRole('region', { name: 'All' })).queryByRole('button', { name: 'Goblet Squat' })).toBeNull()
})

test('DX-08 a long list has no pager: it draws a first chunk and grows as its end scrolls near', () => {
  const watchers: { fire(): void }[] = []
  class FakeObserver {
    constructor(callback: IntersectionObserverCallback) {
      watchers.push({ fire: () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never) })
    }
    observe(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  try {
    render(<ExercisePicker library={many(200)} taken={[]} onPick={vi.fn()} onClose={vi.fn()} />)

    expect(document.querySelectorAll('.picker-row')).toHaveLength(60)
    expect(screen.queryByText(/Page \d+ of/)).toBeNull()
    act(() => watchers[watchers.length - 1].fire())
    expect(document.querySelectorAll('.picker-row')).toHaveLength(120)
  } finally {
    vi.unstubAllGlobals()
  }
})
