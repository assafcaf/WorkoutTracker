// fix-picker-search: the Add exercise overlay's search input carries `.library-search`, whose
// rule in src/ui/LibraryList.css sets `flex: 1` for the Exercises page's row layout. Inside the
// picker's flex column (`.program-editor-picker`) that same `flex: 1` makes the input grow to
// fill the overlay's height instead of staying a single line. jsdom does not lay out CSS, so
// this reads the stylesheet as data (src/test/cssAudit's own convention) and checks the rule
// rather than rendered pixels.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

const cssPath = resolve(fileURLToPath(import.meta.url), '..', 'ProgramEditor.css')
const css = readFileSync(cssPath, 'utf-8')

test('the picker search input does not grow vertically inside the overlay', () => {
  const declarations = declarationsFor(css, '.program-editor-picker .library-search')
  const flex = declarations.get('flex')
  const flexGrow = declarations.get('flex-grow')
  const staysSingleLine = flex === 'none' || flex === '0' || flexGrow === '0'
  expect(staysSingleLine).toBe(true)
})

test('O36 the Program editor picker finds an exercise despite a typo and word order', async () => {
  const { createElement } = await import('react')
  const { render, screen } = await import('@testing-library/react')
  const { default: userEvent } = await import('@testing-library/user-event')
  const { ProgramEditor } = await import('./ProgramEditor')
  type LibraryExercise = import('../types').LibraryExercise
  const entry = (id: string, name: string): LibraryExercise => ({
    id,
    name,
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
  })
  const library = [entry('Dumbbell_Incline_Fly', 'Dumbbell Incline Fly'), entry('Pushups', 'Pushups')]
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  render(
    createElement(ProgramEditor, {
      initial: {
        id: 'p',
        name: 'P',
        units: 'kg',
        sessionsPerWeek: 1,
        workouts: [{ id: 'w', name: 'Day', exercises: [] }],
      },
      isNew: false,
      resolve: () => undefined,
      library,
      gymEquipment: null,
      onSave: () => undefined,
      onCancel: () => undefined,
    }),
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add exercise' }))
  await user.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'fly incline dumbell')
  expect(screen.getByText('Dumbbell Incline Fly')).toBeVisible()
  expect(screen.queryByText('Pushups')).toBeNull()
})
