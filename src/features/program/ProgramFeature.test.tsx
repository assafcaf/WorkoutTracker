// E11-T11 (O10): ProgramFeature is the Program tab's own container over services -- it wraps
// the real ProgramPage and ProgramEditor (untouched, only read for their props) the way
// App.tsx wired them before this epic. Rendered over the real bundled catalog and programs
// (src/data/programs/assaf-ab-2026.json -- "A/B Split", Workout A/Workout B -- and
// full-body-starter, hidden by default) and fake-indexeddb (installed globally,
// src/test/setup.ts).
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { createServices } from '../../services'
import type { AppRoute } from '../routes'
import { db } from '../../storage/db'
import { ACTIVE_PROGRAM_ID_KEY, saveUserProgram } from '../../storage/settingsStore'
import { putSessions } from '../../storage/sessionStore'
import type { Session, UserProgram } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { ProgramFeature } from './ProgramFeature'

const NOW = 1_700_000_000_000
const SETTLE = { timeout: 2000 }
const SAVE_ERROR = 'Couldn’t save — try again'

beforeEach(async () => {
  await db.open()
  await db.settings.clear()
  await db.sessions.clear()
  // E11-T15: the Program tab carries no default active Program of its own (with nothing stored
  // and no Session there is none, E9-T2 O19), so every test starts on A/B Split by storing it.
  await db.settings.put({ key: ACTIVE_PROGRAM_ID_KEY, value: 'assaf-ab-2026', updatedAt: NOW })
})

function inProgressSession(over: Partial<Session> & { id: string; programId: string; workoutId: string }): Session {
  return { startedAt: NOW - 1000, finishedAt: null, entries: [], ...over }
}

function extraVisibleProgram(): UserProgram {
  return {
    id: 'user-second',
    name: 'Second Program',
    units: 'kg',
    sessionsPerWeek: 1,
    workouts: [],
    createdAt: NOW - 1,
  }
}

function renderFeature(
  overrides: { navigate?: (to: AppRoute) => void; onInSession?: (inSession: boolean) => void } = {},
) {
  const navigate = overrides.navigate ?? vi.fn()
  const onInSession = overrides.onInSession ?? vi.fn()
  const services = createServices({ now: () => NOW, storageAvailable: true })
  render(
    <ServicesProvider services={services}>
      <ProgramFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )
  return { navigate, onInSession, services }
}

test('O10 ProgramFeature lists Programs, leading with the active one', async () => {
  await saveUserProgram(extraVisibleProgram(), NOW)

  const user = userEvent.setup()
  renderFeature()

  expect(await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)).toBeVisible()
  // DX-04: the program list is the Programs page, behind its own row.
  await user.click(screen.getByRole('button', { name: 'Programs' }))
  expect(await screen.findByRole('button', { name: /^Second Program/ }, SETTLE)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^A\/B Split/ })).toHaveAttribute('aria-pressed', 'true')
})

test('O10 ProgramFeature switches the active Program when another is chosen', async () => {
  await saveUserProgram(extraVisibleProgram(), NOW)
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  // DX-04: the program list is the Programs page, behind its own row.
  await user.click(screen.getByRole('button', { name: 'Programs' }))

  await user.click(await screen.findByRole('button', { name: /^Second Program/ }, SETTLE))

  await waitFor(() => expect(screen.getByRole('button', { name: /^Second Program/ })).toHaveAttribute('aria-pressed', 'true'), SETTLE)
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(await screen.findByRole('heading', { name: 'Second Program' }, SETTLE)).toBeVisible()
})

test('DX-04 the Program tab has one header action, Edit, and no segmented control, "..." or Switch program select', async () => {
  await saveUserProgram(extraVisibleProgram(), NOW)
  renderFeature()
  const heading = await screen.findByRole('heading', { level: 1, name: 'A/B Split' }, SETTLE)

  const header = heading.closest('header') as HTMLElement
  expect(within(header).getAllByRole('button').map((button) => button.textContent)).toEqual(['Edit'])
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByRole('radiogroup')).toBeNull()
  expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
  expect(document.querySelector('.segmented, .card, table')).toBeNull()
})

test('DX-04 Programs, Deload week, Exercises and Settings are each a labelled row; Exercises and Settings route there', async () => {
  const user = userEvent.setup()
  const { navigate } = renderFeature()
  await screen.findByRole('heading', { level: 1, name: 'A/B Split' }, SETTLE)

  const rows = within(screen.getByRole('list', { name: 'More' })).getAllByRole('button')
  expect(rows.map((row) => row.textContent)).toEqual(['Programs', 'Deload week', 'Exercises', 'Settings'])
  await user.click(screen.getByRole('button', { name: 'Exercises' }))
  await user.click(screen.getByRole('button', { name: /^Settings/ }))
  expect(navigate).toHaveBeenNthCalledWith(1, { tab: 'exercises' })
  expect(navigate).toHaveBeenNthCalledWith(2, { tab: 'settings' })
})

test('DX-03 the Program tab has no decision list and no muscle chart: one muscles row opens Progress › Muscles', async () => {
  const user = userEvent.setup()
  const { navigate } = renderFeature()
  await screen.findByRole('heading', { level: 1, name: 'A/B Split' }, SETTLE)

  expect(screen.queryByText('Needs a decision')).toBeNull()
  expect(screen.queryByText('Weekly sets, planned')).toBeNull()
  expect(screen.queryByText('Muscles, planned per week')).toBeNull()
  expect(document.querySelector('.body-map')).toBeNull()
  const row = screen.getByRole('button', { name: /^69 sets a week · / })
  await user.click(row)
  expect(navigate).toHaveBeenCalledWith({ tab: 'muscles' })
})

test('DX-16 each Workout is a plain list, one row per Plan; a row opens its lift page; no Swap', async () => {
  const user = userEvent.setup()
  const { navigate } = renderFeature()
  const plans = await screen.findByRole('list', { name: 'Workout A' }, SETTLE)

  expect(screen.getByRole('heading', { level: 2, name: /^Workout A · 23 sets · ~\d+ min$/ })).toBeVisible()
  expect(within(plans).getAllByRole('listitem')).toHaveLength(7)
  expect(screen.queryByRole('button', { name: /Swap/ })).toBeNull()
  expect(screen.queryByRole('columnheader')).toBeNull()
  // The usual 1:30 rest goes unsaid; a different one is written out.
  expect(within(plans).getByRole('button', { name: /^Lunges/ })).not.toHaveTextContent('rest')
  expect(within(plans).getByRole('button', { name: /^Back squat/ })).toHaveTextContent('· 3:00 rest')
  await user.click(within(plans).getByRole('button', { name: /^Lunges/ }))
  expect(navigate).toHaveBeenCalledWith({ tab: 'lift', exerciseId: 'lunges' })
})

test('DX-04 first run: the Program tab is the same "Choose a Program" rows, with no filled button', async () => {
  await db.settings.clear()
  const user = userEvent.setup()
  renderFeature()

  expect(await screen.findByRole('heading', { level: 1, name: 'Choose a Program' }, SETTLE)).toBeVisible()
  expect(document.querySelector('.btn-primary')).toBeNull()
  expect(screen.getByRole('button', { name: /^Settings/ })).toBeVisible()
  await user.click(screen.getByRole('button', { name: /^A\/B Split/ }))
  expect(await screen.findByRole('heading', { level: 1, name: 'A/B Split' }, SETTLE)).toBeVisible()
})

test('O10 ProgramFeature opens the editor on New program and reports onInSession(true)', async () => {
  const user = userEvent.setup()
  const onInSession = vi.fn()
  renderFeature({ onInSession })
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  // DX-04: the program list is the Programs page, behind its own row.
  await user.click(screen.getByRole('button', { name: 'Programs' }))

  await user.click(screen.getByRole('button', { name: 'New program' }))

  expect(await screen.findByLabelText('Program name', undefined, SETTLE)).toHaveValue('')
  expect(onInSession).toHaveBeenCalledWith(true)
})

test('O10 ProgramFeature Cancel from the editor returns to the Program list', async () => {
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  // DX-04: the program list is the Programs page, behind its own row.
  await user.click(screen.getByRole('button', { name: 'Programs' }))

  await user.click(screen.getByRole('button', { name: 'New program' }))
  await screen.findByLabelText('Program name', undefined, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Programs' }, SETTLE)).toBeVisible()
})

test('O10 ProgramFeature edits a Program, saving it and returning to the Program list', async () => {
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  // DX-04: a Program is edited from the tab's Edit only; the Programs page has none per Program.
  await user.click(screen.getByRole('button', { name: 'Edit A/B Split' }))

  const nameField = await screen.findByLabelText('Program name', undefined, SETTLE)
  expect(nameField).toHaveValue('A/B Split')
  await user.clear(nameField)
  await user.type(nameField, 'A/B Split Updated')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByRole('heading', { name: 'A/B Split Updated' }, SETTLE)).toBeVisible()
})

test('O10 ProgramFeature copies a Program into a new, separately listed one', async () => {
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  // DX-04: the program list is the Programs page, behind its own row.
  await user.click(screen.getByRole('button', { name: 'Programs' }))

  const row = document.querySelector('[data-program-id="assaf-ab-2026"]')
  if (!row) throw new Error('expected a row for assaf-ab-2026')
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Copy A/B Split' }))

  expect(await screen.findByLabelText('Program name', undefined, SETTLE)).toHaveValue('A/B Split (copy)')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  // Back on the Programs page it came from, the copy listed beside the original.
  expect(await screen.findByRole('button', { name: /^A\/B Split \(copy\)/ }, SETTLE)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^A\/B Split Active/ })).toHaveAttribute('aria-pressed', 'true')
})

test('O10 ProgramFeature resets an edited bundled Program back to its original', async () => {
  await saveUserProgram({ id: 'assaf-ab-2026', name: 'My AB', units: 'kg', sessionsPerWeek: 2, workouts: [], createdAt: NOW }, NOW)
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'My AB' }, SETTLE)
  // DX-04: the program list is the Programs page, behind its own row.
  await user.click(screen.getByRole('button', { name: 'Programs' }))

  const row = document.querySelector('[data-program-id="assaf-ab-2026"]')
  if (!row) throw new Error('expected a row for assaf-ab-2026')
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Reset My AB to original' }))
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Confirm' }))

  expect(await screen.findByRole('button', { name: /^A\/B Split/ }, SETTLE)).toBeVisible()
})

test('O10 ProgramFeature deleting the Program the Session in progress runs on shows the in-progress message', async () => {
  // A stored user Program, the only kind the Program tab offers Delete on (App.tsx's
  // userProgramIds/bundledProgramIds gating, App.programDelete.test.tsx's O11).
  await saveUserProgram(
    {
      id: 'user-stored-solo',
      name: 'Solo Program',
      units: 'kg',
      sessionsPerWeek: 1,
      createdAt: NOW,
      workouts: [{ id: 'workout-solo', name: 'Solo', exercises: [] }],
    },
    NOW,
  )
  await putSessions([inProgressSession({ id: 's1', programId: 'user-stored-solo', workoutId: 'workout-solo' })])
  // The Program tab's own active-Program resolution (services/programs.ts's O5) otherwise falls
  // back to the most recent Session's Program -- here the very Session in progress -- so pin
  // the active Program explicitly to assaf-ab-2026, the one this test starts on.
  await db.settings.put({ key: ACTIVE_PROGRAM_ID_KEY, value: 'assaf-ab-2026', updatedAt: NOW })
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  // DX-04: the program list is the Programs page, behind its own row.
  await user.click(screen.getByRole('button', { name: 'Programs' }))

  const row = document.querySelector('[data-program-id="user-stored-solo"]')
  if (!row) throw new Error('expected a row for user-stored-solo')
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Delete Solo Program' }))
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Confirm' }))

  expect(await screen.findByText('Finish the workout in progress first', undefined, SETTLE)).toBeVisible()
})

test('O10 ProgramFeature a save the in-progress guard rejects shows the in-progress message', async () => {
  const user = userEvent.setup()
  const services = createServices({ now: () => NOW, storageAvailable: true })
  const guardMessage = 'Finish the workout in progress first'
  services.programs.save = vi.fn(async () => {
    const { ServiceError } = await import('../../services/errors')
    throw new ServiceError('in-progress', guardMessage)
  })
  const navigate = vi.fn()
  const onInSession = vi.fn()
  render(
    <ServicesProvider services={services}>
      <ProgramFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  // DX-04: a Program is edited from the tab's Edit only; the Programs page has none per Program.
  await user.click(screen.getByRole('button', { name: 'Edit A/B Split' }))
  await screen.findByLabelText('Program name', undefined, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(guardMessage, undefined, SETTLE)).toBeVisible()
})

test('O10 ProgramFeature a rejected save shows Couldn’t save — try again', async () => {
  const user = userEvent.setup()
  const services = createServices({ now: () => NOW, storageAvailable: true })
  services.programs.save = vi.fn(async () => {
    throw new Error('boom')
  })
  const navigate = vi.fn()
  const onInSession = vi.fn()
  render(
    <ServicesProvider services={services}>
      <ProgramFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  // DX-04: a Program is edited from the tab's Edit only; the Programs page has none per Program.
  await user.click(screen.getByRole('button', { name: 'Edit A/B Split' }))
  await screen.findByLabelText('Program name', undefined, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(SAVE_ERROR, undefined, SETTLE)).toBeVisible()
})

test('DX-04 ProgramFeature keeps the Programs page open across a visit to the editor it opened', async () => {
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Programs' }))

  await user.click(screen.getByRole('button', { name: 'New program' }))
  await screen.findByLabelText('Program name', undefined, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Programs' }, SETTLE)).toBeVisible()
})

test('S7b ProgramFeature opens Edit in the head on the active Program, under its own name', async () => {
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Edit A/B Split' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Edit A/B Split' }, SETTLE)).toBeVisible()
  expect(screen.getByLabelText('Program name')).toHaveValue('A/B Split')
  expect(screen.queryByRole('dialog', { name: 'Programs' })).toBeNull()
})

test('S7b ProgramFeature titles a copy Copy program', async () => {
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Programs' }))

  const row = document.querySelector('[data-program-id="assaf-ab-2026"]') as HTMLElement
  await user.click(within(row).getByRole('button', { name: 'Copy A/B Split' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Copy program' }, SETTLE)).toBeVisible()
})

test('S7a ProgramFeature makes the active Program the one large title, its size line and Edit beside it', async () => {
  renderFeature()

  expect(await screen.findByRole('heading', { level: 1, name: 'A/B Split' }, SETTLE)).toBeVisible()
  expect(screen.getAllByRole('heading', { name: 'A/B Split' })).toHaveLength(1)
  expect(screen.queryByRole('heading', { name: 'Program' })).toBeNull()
  expect(screen.getByText('3× a week · 2 workouts · 69 sets')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Edit A/B Split' })).toBeVisible()
})

test('V1-16 ProgramFeature stores a weight step and Bodyweight chosen in the editor, the settings the live Session reads', async () => {
  const user = userEvent.setup()
  const { services } = renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Edit A/B Split' }))
  await screen.findByLabelText('Program name', undefined, SETTLE)

  // DX-17: a tap on a Plan's row pushes its Plan editor, which holds the Exercise's settings.
  await user.click(screen.getAllByRole('button', { name: /^Back squat, / })[0])
  const step = await screen.findByRole('combobox', { name: 'Back squat weight step' }, SETTLE)
  expect(step).toHaveValue('2.5')
  await user.selectOptions(step, '5')
  await user.click(screen.getByRole('button', { name: 'Back' }))

  await user.click(screen.getAllByRole('button', { name: /^Push-ups, / })[0])
  const bodyweight = screen.getByRole('switch', { name: 'Bodyweight exercise' })
  expect(bodyweight).toBeChecked()
  await user.click(bodyweight)
  await user.click(screen.getByRole('button', { name: 'Back' }))

  await user.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByRole('heading', { level: 1, name: 'A/B Split' }, SETTLE)

  expect(await services.preferences.weightStep('back-squat')).toBe(5)
  expect(await services.preferences.bodyweightOverrides()).toEqual({ 'push-ups': false })
})

test('V1-16 ProgramFeature Cancel leaves the stored Exercise settings untouched', async () => {
  const user = userEvent.setup()
  const { services } = renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Edit A/B Split' }))
  await screen.findByLabelText('Program name', undefined, SETTLE)

  await user.click(screen.getAllByRole('button', { name: /^Back squat, / })[0])
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Back squat weight step' }, SETTLE), '5')
  await user.click(screen.getByRole('button', { name: 'Back' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(screen.getByRole('button', { name: 'Discard' }))

  expect(await services.preferences.weightStep('back-squat')).toBeNull()
})

// --- UX v6 (V6-15): the kg each lift opens on, and the one duration Train shows too -----------

function finishedA(id: string, startedAt: number, minutes: number): Session {
  const squat = (setIndex: number, weightKg: number, reps: number) => ({
    exerciseId: 'back-squat',
    setIndex,
    weightKg,
    reps,
    loggedAt: startedAt + setIndex,
  })
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: startedAt + minutes * 60_000,
    entries: [squat(1, 47.5, 10), squat(2, 57.5, 10), squat(3, 62.5, 8), squat(4, 62.5, 8)],
  }
}

test('V6-15 Program read mode shows the Back squat row opening 47.5 → 62.5, and Train’s minutes', async () => {
  const day = 86_400_000
  await putSessions([
    finishedA('a1', NOW - 9 * day, 60),
    finishedA('a2', NOW - 6 * day, 70),
    finishedA('a3', NOW - 3 * day, 80),
  ])
  renderFeature()

  const plans = await screen.findByRole('list', { name: 'Workout A' }, SETTLE)
  const row = within(plans).getByRole('button', { name: /^Back squat/ })
  // The Sessions arrive after the Programs: the row fills in once they do.
  await waitFor(() => expect(row.querySelector('.program-plan-figure')?.textContent).toBe('4 × 8–10 · 47.5 → 62.5 kg · 3:00 rest'), SETTLE)
  // The median of the last three logged durations, as Train's dock says it.
  expect(screen.getByRole('heading', { level: 2, name: 'Workout A · 23 sets · ~70 min' })).toBeVisible()
})

test('N2 the Program editor shows the same Plan figures and minutes as the Program tab', async () => {
  const day = 24 * 60 * 60 * 1000
  // Three logged 70-minute Workout A Sessions: the minutes come from them, the squat load too.
  const logged: Session[] = [3, 2, 1].map((back, i) => ({
    id: `s-${i}`,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: NOW - back * 7 * day,
    finishedAt: NOW - back * 7 * day + 70 * 60 * 1000,
    entries: [0, 1, 2, 3].map((setIndex) => ({
      exerciseId: 'back-squat',
      setIndex,
      weightKg: 60,
      reps: 10,
      loggedAt: NOW - back * 7 * day + setIndex * 60_000,
    })),
  }))
  await putSessions(logged)
  const user = userEvent.setup()
  renderFeature()

  const tabHeading = await screen.findByRole('heading', { name: /^Workout A · \d+ sets · ~70 min$/ }, SETTLE)
  const tabSquat = within(screen.getByRole('list', { name: 'Workout A' })).getAllByRole('button')[0]
  const tabFigure = tabSquat.querySelector('.program-plan-figure')?.textContent ?? ''
  expect(tabFigure).toMatch(/kg/)

  await user.click(screen.getByRole('button', { name: 'Edit A/B Split' }))
  const editorA = await screen.findByRole('region', { name: 'Workout A' }, SETTLE)
  expect(within(editorA).getByText(tabHeading.textContent!.replace('Workout A · ', ''))).toBeVisible()
  const editorSquat = within(editorA).getByRole('button', { name: /^Back squat, / })
  expect(editorSquat.querySelector('.program-editor-plan-line')?.textContent).toBe(tabFigure)
})
