import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import assafJson from '../data/programs/assaf-ab-2026.json'
import starterJson from '../data/programs/full-body-starter.json'
import exercisesJson from '../data/exercises.json'
import { ProgramPicker } from './ProgramPicker'
import type { Exercise, Program } from '../types'

// The picker is fed the shipped data files directly, so these tests stay independent of
// catalog.ts while still asserting what the trainee actually sees on the real program.
const assaf = assafJson as unknown as Program
const starter = starterJson as unknown as Program
const seeded = exercisesJson as Exercise[]

function catalogWithout(missing: string[] = []): Map<string, Exercise> {
  return new Map(
    seeded.filter((e) => !missing.includes(e.id)).map((e) => [e.id, e] as const),
  )
}

function renderPicker(catalog: Map<string, Exercise> = catalogWithout()) {
  const onChoose = vi.fn()
  render(
    <ProgramPicker
      programs={[assaf, starter]}
      catalog={catalog}
      activeProgramId="assaf-ab-2026"
      onChoose={onChoose}
    />,
  )
  return { onChoose }
}

function precedes(first: Element, second: Element): boolean {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  )
}

function lines(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole('listitem')
    .map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim())
}

test('O1 the active program leads with Workout A then Workout B, above the other programs', () => {
  renderPicker()

  const program = screen.getByRole('heading', { name: 'Assaf A/B 2026' })
  const workoutA = screen.getByRole('heading', { name: 'Workout A' })
  const workoutB = screen.getByRole('heading', { name: 'Workout B' })
  const others = screen.getByRole('button', { name: 'Other programs (1)' })

  expect([
    precedes(program, workoutA),
    precedes(workoutA, workoutB),
    precedes(workoutB, others),
  ]).toEqual([true, true, true])
})

test('O1 Workout A names its seven exercises with rep target and set count', () => {
  renderPicker()

  const [listA] = screen.getAllByRole('list')
  expect(lines(listA)).toEqual([
    'Back squat 8-10 x 4',
    'Lunges 10-12 x 3',
    'DB bench press 8-10 x 4',
    'Push-ups 10-15 x 3',
    'Machine shoulder press 8-10 x 3',
    'Lateral raises 10-15 x 3',
    'Cable push-down 10-12 x 3',
  ])
})

test('O1 Workout B names its seven exercises with rep target and set count', () => {
  renderPicker()

  const listB = screen.getAllByRole('list')[1]
  expect(lines(listB)).toEqual([
    'Deadlift 8-10 x 3',
    'Assisted pull-ups 5-8 x 4',
    'Narrow-grip pull-down 10-12 x 3',
    'Machine row 8-10 x 4',
    'Face pull 10-15 x 3',
    'Hyper-extension 10-15 x 3',
    'Seated biceps curls 10-12 x 3',
  ])
})

test('O1 the one remaining program sits collapsed under "Other programs (1)"', () => {
  renderPicker()

  const others = screen.getByRole('button', { name: 'Other programs (1)' })
  expect(others).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('Full body starter')).toBeNull()
})

test('O1 opening the other programs disclosure reveals the remaining program', async () => {
  const user = userEvent.setup()
  renderPicker()

  await user.click(screen.getByRole('button', { name: 'Other programs (1)' }))

  expect(screen.getByText('Full body starter')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Other programs (1)' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
})

test('O2 a plan referencing an id absent from the catalog fails naming the program and the id', () => {
  let thrown: unknown
  try {
    renderPicker(catalogWithout(['deadlift']))
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(Error)
  expect((thrown as Error).message).toContain('assaf-ab-2026')
  expect((thrown as Error).message).toContain('deadlift')
})

test('O2 no picker renders when a plan references an id absent from the catalog', () => {
  // Positive control first: the same programs with a complete catalog do render a picker,
  // so the emptiness asserted below is caused by the dangling id and nothing else.
  renderPicker()
  expect(screen.getByRole('heading', { name: 'Workout A' })).toBeVisible()
  cleanup()

  try {
    renderPicker(catalogWithout(['deadlift']))
  } catch {
    // the hard error itself is asserted by the test above; here only the DOM matters
  }

  expect(screen.queryByRole('heading', { name: 'Workout A' })).toBeNull()
  expect(screen.queryByText('Back squat 8-10 x 4')).toBeNull()
})
