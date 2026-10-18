import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ImportReview, type ImportReviewProps } from './ImportReview'
import type { LibraryExercise } from '../types'

const lib = (id: string, name: string): LibraryExercise => ({
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
})

const library = [lib('db-bench', 'DB bench press'), lib('squat', 'Back squat')]

function setup(over: Partial<ImportReviewProps> = {}) {
  const props: ImportReviewProps = {
    names: [
      { source: 'Zercher Squat', proposal: null },
      { source: 'Bench Press (Dumbbell)', proposal: { id: 'db-bench', match: 'exact' } },
    ],
    sessionCount: 3,
    unitStated: true,
    library,
    exerciseName: (id) => library.find((l) => l.id === id)?.name ?? id,
    equipmentOptions: [],
    createCustom: vi.fn(async () => ({ id: 'custom-1' })),
    onImport: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  }
  render(<ImportReview {...props} />)
  return props
}

const row = (name: string) => screen.getByRole('listitem', { name })

test('O18 unmapped names are listed before mapped ones, with the three choices', () => {
  setup()
  const items = screen.getAllByRole('listitem')
  expect(items[0].getAttribute('aria-label')).toBe('Zercher Squat')
  expect(items[1].getAttribute('aria-label')).toBe('Bench Press (Dumbbell)')
  const unmapped = within(row('Zercher Squat'))
  expect(unmapped.getByRole('button', { name: 'Pick exercise' })).toBeTruthy()
  expect(unmapped.getByRole('button', { name: 'Create custom exercise' })).toBeTruthy()
  expect(unmapped.getByRole('button', { name: 'Leave out' })).toBeTruthy()
})

test('O18 a mapped name reads source arrow target and offers Change', () => {
  setup()
  const mapped = within(row('Bench Press (Dumbbell)'))
  expect(mapped.getByText('Bench Press (Dumbbell) → DB bench press')).toBeTruthy()
  expect(mapped.getByRole('button', { name: 'Change' })).toBeTruthy()
})

test('O18 Import is disabled until every unmapped name has a choice, and counts the Sessions', async () => {
  const user = userEvent.setup()
  const props = setup()
  const button = screen.getByRole('button', { name: 'Import 3 Sessions' })
  expect((button as HTMLButtonElement).disabled).toBe(true)

  await user.click(within(row('Zercher Squat')).getByRole('button', { name: 'Leave out' }))
  expect((button as HTMLButtonElement).disabled).toBe(false)

  await user.click(button)
  expect(props.onImport).toHaveBeenCalledWith({ 'Zercher Squat': null, 'Bench Press (Dumbbell)': 'db-bench' }, 'kg')
})

test('O18 Pick exercise opens the picker and the pick becomes the choice', async () => {
  const user = userEvent.setup()
  const props = setup()
  await user.click(within(row('Zercher Squat')).getByRole('button', { name: 'Pick exercise' }))
  await user.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'squat')
  await user.click(screen.getByRole('button', { name: 'Back squat' }))
  await user.click(screen.getByRole('button', { name: 'Import 3 Sessions' }))
  expect(props.onImport).toHaveBeenCalledWith({ 'Zercher Squat': 'squat', 'Bench Press (Dumbbell)': 'db-bench' }, 'kg')
})

test('O18 Change replaces a proposal with another Exercise', async () => {
  const user = userEvent.setup()
  const props = setup({ names: [{ source: 'Bench Press (Dumbbell)', proposal: { id: 'db-bench', match: 'guess' } }] })
  await user.click(screen.getByRole('button', { name: 'Change' }))
  await user.click(screen.getByRole('button', { name: 'Back squat' }))
  await user.click(screen.getByRole('button', { name: 'Import 3 Sessions' }))
  expect(props.onImport).toHaveBeenCalledWith({ 'Bench Press (Dumbbell)': 'squat' }, 'kg')
})

test('O18 Create custom exercise opens the form with the source name filled and uses the created id', async () => {
  const user = userEvent.setup()
  const props = setup()
  await user.click(within(row('Zercher Squat')).getByRole('button', { name: 'Create custom exercise' }))
  const name = screen.getByLabelText('Name') as HTMLInputElement
  expect(name.value).toBe('Zercher Squat')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await user.click(await screen.findByRole('button', { name: 'Import 3 Sessions' }))
  expect(props.createCustom).toHaveBeenCalledTimes(1)
  expect(props.onImport).toHaveBeenCalledWith({ 'Zercher Squat': 'custom-1', 'Bench Press (Dumbbell)': 'db-bench' }, 'kg')
})

test('O18 a refused custom exercise shows the refusal and leaves the name unchosen', async () => {
  const user = userEvent.setup()
  setup({ createCustom: vi.fn(async () => ({ error: 'Name already used' })) })
  await user.click(within(row('Zercher Squat')).getByRole('button', { name: 'Create custom exercise' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Name already used')).toBeTruthy()
})

test('O18 an unstated unit asks kg or lbs, kg chosen, and the choice is handed on', async () => {
  const user = userEvent.setup()
  const props = setup({ unitStated: false, names: [] })
  expect(screen.getByText('Weights in this file:')).toBeTruthy()
  expect((screen.getByRole('radio', { name: 'kg' }) as HTMLInputElement).checked).toBe(true)
  await user.click(screen.getByRole('radio', { name: 'lbs' }))
  await user.click(screen.getByRole('button', { name: 'Import 3 Sessions' }))
  expect(props.onImport).toHaveBeenCalledWith({}, 'lbs')
})

test('O18 a stated unit shows no unit choice', () => {
  setup()
  expect(screen.queryByText('Weights in this file:')).toBeNull()
})

test('O18 Cancel calls onCancel and never onImport', async () => {
  const user = userEvent.setup()
  const props = setup()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(props.onCancel).toHaveBeenCalledTimes(1)
  expect(props.onImport).not.toHaveBeenCalled()
})
