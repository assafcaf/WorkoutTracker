import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import assafJson from '../data/programs/assaf-ab-2026.json'
import exercisesJson from '../data/exercises.json'
import { ProgramPage } from './ProgramPage'
import type { Exercise, Program } from '../types'

// fix-newuser-chooser: the no-active-Program chooser matches the app's card/primary-button
// styling (E9's active-program radio cards, the Workout tab's `.start-workout`).

const assaf = assafJson as unknown as Program
const secondProgram: Program = { ...assaf, id: 'second-program', name: 'Push Pull Legs' }
const seeded = exercisesJson as Exercise[]

function catalog(): Map<string, Exercise> {
  return new Map(seeded.map((e) => [e.id, e] as const))
}

function renderNewUser() {
  render(
    <ProgramPage
      programs={[assaf, secondProgram]}
      activeProgramId={null}
      catalog={catalog()}
      library={new Map()}
      onChooseProgram={vi.fn()}
    />,
  )
}

describe('ProgramPage new-user chooser styling', () => {
  test('the offered-programs list carries no bullets', () => {
    renderNewUser()

    const list = document.querySelector('.program-page-newuser-list')
    expect(list).not.toBeNull()
    expect(list?.tagName.toLowerCase()).not.toBe('ul')
  })

  test('each Use this button carries the primary button class', () => {
    renderNewUser()

    const useAssaf = screen.getByRole('button', { name: `Use this ${assaf.name}` })
    const useSecond = screen.getByRole('button', { name: `Use this ${secondProgram.name}` })
    expect(useAssaf.className).toContain('program-page-use-primary')
    expect(useSecond.className).toContain('program-page-use-primary')
  })
})
