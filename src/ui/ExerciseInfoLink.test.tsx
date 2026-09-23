import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { ExerciseInfoLink } from './ExerciseInfoLink'
import type { Exercise } from '../types'

// deadlift is a real catalog fixture, loaded the way every other ExerciseInfoLink consumer
// (SetScreen) does -- not a hand-rolled Exercise -- so a wrong catalog field would fail here
// too rather than masking a real regression.
const catalog = loadCatalog()
const deadlift = catalog.get('deadlift') as Exercise

test('L14 the exercise info control renders as a button named "Exercise info" rather than a link', () => {
  render(<ExerciseInfoLink exercise={deadlift} onOpen={() => {}} />)

  expect(screen.getByRole('button', { name: 'Exercise info' })).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Exercise info' })).toBeNull()
})

test('L14 tapping the exercise info button calls onOpen once', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  render(<ExerciseInfoLink exercise={deadlift} onOpen={onOpen} />)

  await user.click(screen.getByRole('button', { name: 'Exercise info' }))

  expect(onOpen).toHaveBeenCalledTimes(1)
})
