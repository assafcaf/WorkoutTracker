// DX-01: the Train tab is today's Workout inside the Shell -- its name as the title, one meta line,
// the change note, the Plan list and one Start -- and nothing that copies another tab.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { declarationsFor } from '../../test/cssAudit'
import { ShellChromeContext } from '../../ui/AppShell'
import { DashboardView, type DashboardData, type DashboardViewProps } from './DashboardView'

const READY: DashboardData = {
  kind: 'ready',
  card: {
    name: 'Workout A',
    minutes: 48,
    estimate: 'logged',
    lifts: [
      { exerciseId: 'deadlift', name: 'Deadlift', sets: 3, load: '70 kg', reps: '8–10', advice: null },
      {
        exerciseId: 'seated-biceps-curl',
        name: 'Seated biceps curls',
        sets: 3,
        load: '12.5 kg',
        reps: '10–12',
        advice: { kind: 'up', lever: 15, text: 'Ready for 15 kg', use: 'Use 15 kg' },
      },
      { exerciseId: 'face-pull', name: 'Face pulls', sets: 3, load: null, reps: '12–15', advice: null },
    ],
  },
  due: { workoutId: 'workout-a', name: 'Workout A', last: 'Fri 9 Oct', sameAs: 'Friday', minutes: 53 },
  meta: 'Tuesday · 1 of 3 this week',
  rest: false,
}

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'DashboardScreen.css'), 'utf-8')

function renderView(overrides: Partial<DashboardViewProps> = {}) {
  const props: DashboardViewProps = { data: READY, onStartWorkout: vi.fn(), ...overrides }
  render(
    <ShellChromeContext.Provider value={{ tab: 'train', onTabChange: vi.fn() }}>
      <DashboardView {...props} />
    </ShellChromeContext.Provider>,
  )
  return props
}

describe('DX-01 the Train tab', () => {
  test('the title is the Workout due, with one quiet meta line under it, inside the Shell', () => {
    renderView()

    expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toBeTruthy()
    expect(screen.getByText('Tuesday · 1 of 3 this week')).toHaveClass('page-header-subtitle')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('button', { name: 'Train' })).toHaveAttribute('aria-current', 'page')
  })

  test('the change note, then one row per Plan, then the size and one filled Start', () => {
    const props = renderView()

    expect(screen.getByText(/^Same as Friday, except/)).toHaveTextContent('Same as Friday, except curls move up to 15 kg.')
    const rows = within(screen.getByRole('list', { name: 'Workout A lifts' })).getAllByRole('listitem')
    expect(rows.map((row) => row.querySelector('.dashboard-step-name')?.textContent)).toEqual([
      'Deadlift',
      'Seated biceps curls',
      'Face pulls',
    ])
    expect(screen.getByText('9 sets · about 53 min')).toBeTruthy()
    const filled = document.querySelectorAll('.btn-primary')
    expect([...filled].map((button) => button.textContent)).toEqual(['Start Workout A'])
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout A' }))
    expect(props.onStartWorkout).toHaveBeenCalledWith('workout-a')
  })

  test('nothing copies another tab: no ring, sparkline, heatmap, last Session, week strip, gear, arrows or sync line', () => {
    renderView()

    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^This week/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /workout:/i })).toBeNull()
    expect(screen.queryByText(/Not synced/)).toBeNull()
    expect(document.querySelector('.home-ring, .home-lifts, .home-grid, .home-last, .dashboard-week')).toBeNull()
  })

  test('a lift name opens its Lift page', () => {
    const onOpenLift = vi.fn()
    renderView({ onOpenLift })
    fireEvent.click(screen.getByRole('button', { name: 'Deadlift' }))
    expect(onOpenLift).toHaveBeenCalledWith('deadlift')
  })

  test('a rest day keeps the layout; Start reads "anyway" in outline, and no filled button is left', () => {
    renderView({ data: { ...READY, meta: 'Rest day · next: Workout A, Friday', rest: true } as DashboardData })

    expect(screen.getByText('Rest day · next: Workout A, Friday')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start Workout A anyway' })).toHaveClass('btn-secondary')
    expect(document.querySelector('.btn-primary')).toBeNull()
  })

  test('notices are drawn under the header', () => {
    renderView({ notices: <p>Storage is unavailable</p> })
    expect(screen.getByText('Storage is unavailable').closest('.dashboard-notices')).not.toBeNull()
  })

  test('a row wraps its name and Preset rather than cutting the name', () => {
    const name = declarationsFor(css, '.dashboard-step-name')
    expect(name.get('text-overflow')).toBeUndefined()
    expect(name.get('white-space')).toBeUndefined()
    expect(declarationsFor(css, '.dashboard-step-line').get('flex-wrap')).toBe('wrap')
  })
})

describe('DX-09 a Session in progress', () => {
  test('Train shows the live Workout’s Plans and no Start and no Resume: the strip is the one way back', () => {
    renderView({ resume: { workoutName: 'Workout A', programName: 'A/B Split', workoutId: 'workout-a' } })

    expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toBeTruthy()
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Workout A lifts' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Start/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Resume/ })).toBeNull()
  })

  test('with no strip to resume from (no app root), the dock is one Resume', () => {
    const onResume = vi.fn()
    renderView({ resume: { workoutName: 'Workout A', programName: 'A/B Split', workoutId: 'workout-a', onResume } })

    fireEvent.click(screen.getByRole('button', { name: 'Resume Workout A' }))
    expect(onResume).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /^Start/ })).toBeNull()
  })
})

describe('DX-04 first run', () => {
  const NO_PROGRAM = (onChoose = vi.fn(), canUse = true): DashboardData => ({
    kind: 'no-program',
    canUse,
    onChoose,
    options: [
      { id: 'ab', name: 'A/B Split', summary: '3× a week · 2 workouts' },
      { id: 'ul', name: 'Upper/Lower', summary: '4× a week · 2 workouts' },
    ],
  })

  test('"Choose a Program" as two plain rows; a row makes that Program active', () => {
    const onChoose = vi.fn()
    renderView({ data: NO_PROGRAM(onChoose) })

    expect(screen.getByRole('heading', { level: 1, name: 'Choose a Program' })).toBeTruthy()
    const rows = within(screen.getByRole('list', { name: 'Programs' })).getAllByRole('button')
    expect(rows.map((row) => row.textContent)).toEqual(['A/B Split3× a week · 2 workouts', 'Upper/Lower4× a week · 2 workouts'])
    expect(document.querySelector('.btn-primary, .card')).toBeNull()
    expect(document.body.textContent).not.toMatch(/plan/i)
    fireEvent.click(rows[1])
    expect(onChoose).toHaveBeenCalledWith('ul')
  })

  test('when nothing can be stored no Program can be taken up', () => {
    renderView({ data: NO_PROGRAM(vi.fn(), false) })
    expect(screen.getByRole('button', { name: /^A\/B Split/ })).toBeDisabled()
  })
})

describe('the change note', () => {
  const due = READY.kind === 'ready' ? READY.due! : null!

  test('V6-11 after a short Session it says what is left of the Workout', () => {
    renderView({
      data: { ...READY, due: { ...due, finish: 'Workout A again · last one was cut short on Mon 12 Oct' } } as DashboardData,
    })
    expect(screen.getByText(/^Workout A again · last one was cut short on Mon 12 Oct\./)).toBeTruthy()
  })

  test('V6-08 the Workout’s last Session note folds into it, read whole', () => {
    renderView({
      data: { ...READY, due: { ...due, note: 'Note from Wed 7 Oct: Right elbow sore on pull-downs, dropped the weight.' } } as DashboardData,
    })
    const note = screen.getByText(/Note from Wed 7 Oct: Right elbow sore on pull-downs, dropped the weight\.$/)
    expect(note.closest('.dashboard-headline')).not.toBeNull()
    expect(declarationsFor(css, '.dashboard-headline').get('-webkit-line-clamp')).toBeUndefined()
  })

  test('V6-05 after a break it says once that loads are eased, not on every row', () => {
    const eased = { kind: 'eased' as const, lever: 13, text: 'Eased after 34 days off', use: null }
    const lifts = READY.card!.lifts.map((lift) => ({ ...lift, advice: eased }))
    renderView({ data: { ...READY, card: { ...READY.card!, lifts, eased: true } } as DashboardData })
    expect(screen.getByText('Back after 34 days off: loads eased 10 % for today.')).toBeTruthy()
    expect(screen.queryByText('Eased after 34 days off')).toBeNull()
  })
})

describe('Train: doing a workout other than the one due', () => {
  const B_CARD = { ...(READY as Extract<DashboardData, { kind: 'ready' }>).card!, name: 'Workout B' }
  const WITH_B: DashboardData = {
    ...(READY as Extract<DashboardData, { kind: 'ready' }>),
    others: [{ workoutId: 'workout-b', name: 'Workout B', last: 'Mon 12 Oct', minutes: 60 }],
    cards: { 'workout-b': B_CARD },
  }

  test('a labelled "Change" opens the workouts; choosing one makes it the title and the Start', () => {
    const props = renderView({ data: WITH_B })

    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    const sheet = screen.getByRole('dialog', { name: 'Choose a workout' })
    expect(within(sheet).getByText('Due next')).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: /Workout B/ }))

    expect(screen.getByRole('heading', { level: 1, name: 'Workout B' })).toBeTruthy()
    expect(screen.getByText('Instead of Workout A')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout B' }))
    expect(props.onStartWorkout).toHaveBeenCalledWith('workout-b')
  })

  test('a Program with one workout offers no Change', () => {
    renderView()
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()
  })
})
