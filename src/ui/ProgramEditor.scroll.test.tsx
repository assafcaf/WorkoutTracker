// E9: fix-editor-scroll. Opening the Program editor from a Program tab scrolled down must land
// on the Program name, not wherever the tab had scrolled to.
import { render } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ProgramEditor } from './ProgramEditor'
import type { Program } from '../types'

function blank(): Program {
  return { id: 'user-new', name: '', units: 'kg', sessionsPerWeek: 1, workouts: [] }
}

let scrollTo: ReturnType<typeof vi.fn>

beforeEach(() => {
  scrollTo = vi.fn()
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('mounting the editor scrolls the window to the top', () => {
  render(
    <ProgramEditor
      initial={blank()}
      isNew={true}
      resolve={() => undefined}
      library={[]}
      gymEquipment={null}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  )

  expect(scrollTo).toHaveBeenCalledWith(0, 0)
})
