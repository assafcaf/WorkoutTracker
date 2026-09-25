import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { WeightDial } from './WeightDial'
import type { Exercise } from '../types'

// The real catalog: back-squat's weightStep is 2.5 kg; push-ups is bodyweight (no ladder).
const catalog = loadCatalog()

function exerciseOf(id: string): Exercise {
  const exercise = catalog.get(id)
  if (!exercise) throw new Error(`fixture error: no exercise ${id} in the loaded catalog`)
  return exercise
}

const backSquat = exerciseOf('back-squat')
const pushUps = exerciseOf('push-ups')

/** The step control: a native select named for the weight step it currently reads. */
function stepControl(step: number): HTMLElement {
  return screen.getByRole('combobox', { name: `Step ${step} kg` })
}

// --- O1: the per-Exercise step control -----------------------------------------------------

test('O1 the step control is shown for a loaded Exercise given onStepChange, and withheld otherwise', () => {
  const { rerender } = render(
    <WeightDial exercise={backSquat} value={60} onChange={vi.fn()} onStepChange={vi.fn()} />,
  )
  expect(stepControl(2.5)).toBeInTheDocument()

  rerender(<WeightDial exercise={backSquat} value={60} onChange={vi.fn()} />)
  expect(screen.queryByRole('combobox', { name: /^Step/ })).toBeNull()

  rerender(<WeightDial exercise={pushUps} value={null} onChange={vi.fn()} onStepChange={vi.fn()} />)
  expect(screen.queryByRole('combobox', { name: /^Step/ })).toBeNull()
})

test('O1 the step control reads Step 2.5 kg for back-squat when onStepChange is given', () => {
  render(<WeightDial exercise={backSquat} value={60} onChange={vi.fn()} onStepChange={vi.fn()} />)

  expect(stepControl(2.5)).toBeInTheDocument()
})

test('O1 the step control offers 0.5, 1, 1.25, 2.5, 5, 10 as its options', () => {
  render(<WeightDial exercise={backSquat} value={60} onChange={vi.fn()} onStepChange={vi.fn()} />)

  const options = within(stepControl(2.5)).getAllByRole('option')
  expect(options.map((option) => option.textContent)).toEqual(['0.5', '1', '1.25', '2.5', '5', '10'])
})

test('O1 choosing 5 from the step options calls onStepChange with 5', async () => {
  const user = userEvent.setup()
  const onStepChange = vi.fn()
  render(<WeightDial exercise={backSquat} value={60} onChange={vi.fn()} onStepChange={onStepChange} />)

  await user.selectOptions(stepControl(2.5), '5')

  expect(onStepChange).toHaveBeenCalledWith(5)
})
