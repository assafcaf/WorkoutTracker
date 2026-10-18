import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { CustomExerciseForm } from './CustomExerciseForm'

const EQUIPMENT = ['barbell', 'dumbbell']

function setup(over: Partial<Parameters<typeof CustomExerciseForm>[0]> = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(<CustomExerciseForm equipmentOptions={EQUIPMENT} onSave={onSave} onCancel={onCancel} {...over} />)
  return { onSave, onCancel, user: userEvent.setup() }
}

test('O19 the form saves its name, muscles, equipment, Bodyweight flag and weight step', async () => {
  const { onSave, user } = setup()
  await user.type(screen.getByRole('textbox', { name: 'Name' }), '  Sled push ')
  await user.click(
    within(screen.getByRole('group', { name: 'Primary muscles' })).getByRole('button', { name: 'quadriceps' }),
  )
  await user.click(
    within(screen.getByRole('group', { name: 'Secondary muscles' })).getByRole('button', { name: 'glutes' }),
  )
  await user.selectOptions(screen.getByRole('combobox', { name: 'Equipment' }), 'dumbbell')
  await user.click(screen.getByRole('switch', { name: 'Bodyweight' }))
  const step = screen.getByRole('spinbutton', { name: 'Weight step' })
  await user.clear(step)
  await user.type(step, '5')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledWith({
    name: 'Sled push',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes'],
    equipment: 'dumbbell',
    bodyweight: true,
    weightStep: 5,
  })
})

test('O19 the form with no equipment chosen saves equipment null, and shows a save error', async () => {
  const { onSave, user } = setup({ error: 'A custom exercise needs a name.' })
  expect(screen.getByRole('alert')).toHaveTextContent('A custom exercise needs a name.')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ equipment: null, name: '' }))
})

test('O21 editing starts from the Exercise given and Cancel leaves without saving', async () => {
  const { onSave, onCancel, user } = setup({
    initial: {
      name: 'Sled push',
      primaryMuscles: ['quadriceps'],
      secondaryMuscles: [],
      equipment: 'barbell',
      bodyweight: false,
      weightStep: 2.5,
    },
  })
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Sled push')
  expect(screen.getByRole('spinbutton', { name: 'Weight step' })).toHaveValue(2.5)
  expect(screen.getByRole('combobox', { name: 'Equipment' })).toHaveValue('barbell')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCancel).toHaveBeenCalled()
  expect(onSave).not.toHaveBeenCalled()
})
