import { render, screen } from '@testing-library/react'
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
