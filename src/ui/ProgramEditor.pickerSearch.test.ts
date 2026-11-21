// O36: the Program editor's picker (DX-08: the one ExercisePicker) forgives a typo and word order.
import { expect, test } from 'vitest'

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
