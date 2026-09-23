import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { ExerciseInfoLink } from './ExerciseInfoLink'
import type { Exercise } from '../types'

// deadlift is used only as a plausible Exercise fixture. E5-T8 turns "Exercise info" into a
// button that opens the in-app detail screen instead of leaving the app, so nothing below
// reads exercise.infoUrl or asserts on an href.
const catalog = loadCatalog()
const deadlift = catalog.get('deadlift') as Exercise

test('L14 the exercise info control renders as a button named "Exercise info", not a link', () => {
  render(<ExerciseInfoLink exercise={deadlift} onOpen={() => {}} />)

  expect(screen.getByRole('button', { name: 'Exercise info' })).toBeVisible()
  expect(screen.queryByRole('link')).toBeNull()
})

test('L14 tapping the exercise info control calls onOpen exactly once', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  render(<ExerciseInfoLink exercise={deadlift} onOpen={onOpen} />)

  await user.click(screen.getByRole('button', { name: 'Exercise info' }))

  expect(onOpen).toHaveBeenCalledTimes(1)
})
