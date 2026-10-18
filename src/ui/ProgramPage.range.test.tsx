import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import assafJson from '../data/programs/assaf-ab-2026.json'
import exercisesJson from '../data/exercises.json'
import libraryJson from '../data/library/exercises.json'
import { plannedAgainstRange } from '../domain/setRange'
import { ProgramPage } from './ProgramPage'
import type { Exercise, LibraryExercise, Program } from '../types'

afterEach(cleanup)

const assaf = assafJson as unknown as Program
const catalog = new Map((exercisesJson as Exercise[]).map((e) => [e.id, e] as const))
const library = new Map((libraryJson as LibraryExercise[]).map((e) => [e.id, e] as const))

// [O20] The Program tab lists the 12 muscles' planned weekly Sets against 10-20, in words.
test('[O20] Muscles, planned per week lists 12 muscles with the range and a word for each outside it', () => {
  render(
    <ProgramPage
      programs={[assaf]}
      activeProgramId="assaf-ab-2026"
      catalog={catalog}
      library={library}
      onChooseProgram={() => {}}
      programsOpen
    />,
  )
  const section = screen.getByRole('heading', { name: 'Muscles, planned per week' }).closest('section')!
  expect(section.textContent).toContain('10–20')
  const rows = within(section)
    .getAllByRole('listitem')
    .filter((li) => li.className.includes('program-page-range-row'))
  expect(rows).toHaveLength(12)
  const expected = plannedAgainstRange(assaf, (id) => catalog.get(id), library)
  expected.forEach((e, i) => {
    const text = rows[i].textContent ?? ''
    expect(text).toContain(String(e.planned))
    if (e.standing === 'below') expect(text).toContain('below 10')
    else if (e.standing === 'above') expect(text).toContain('above 20')
    else expect(text).not.toMatch(/below 10|above 20/)
  })
  expect(expected.some((e) => e.standing !== 'within')).toBe(true)
})
