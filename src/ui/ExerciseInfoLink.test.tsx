import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { ExerciseInfoLink } from './ExerciseInfoLink'
import type { Exercise } from '../types'

// `deadlift`'s infoUrl is a literal muscleandstrength.com URL in src/data/exercises.json. It is
// never fetched here or anywhere else -- only its markup is asserted.
const catalog = loadCatalog()
const deadlift = catalog.get('deadlift') as Exercise

test('O16 the deadlift info control links to its curated muscleandstrength.com URL', () => {
  render(<ExerciseInfoLink exercise={deadlift} />)

  const link = screen.getByRole('link', { name: 'Exercise info' })
  expect(link).toHaveAttribute(
    'href',
    'https://www.muscleandstrength.com/exercises/deadlift.html',
  )
})

test('O16 the deadlift info control opens in a new tab without exposing the opener', () => {
  render(<ExerciseInfoLink exercise={deadlift} />)

  const link = screen.getByRole('link', { name: 'Exercise info' })
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})
