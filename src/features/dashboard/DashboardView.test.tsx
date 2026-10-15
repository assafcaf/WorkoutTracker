import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ShellChromeContext } from '../../ui/AppShell'
import { DashboardView, type DashboardData, type DashboardViewProps } from './DashboardView'

const READY: DashboardData = {
  kind: 'ready',
  card: {
    name: 'Workout A',
    minutes: 48,
    estimate: 'logged',
    lifts: [
      { exerciseId: 'deadlift', name: 'Deadlift', step: { reps: 14, target: 20, at: '70 kg', suggest: null } },
      {
        exerciseId: 'seated-biceps-curl',
        name: 'Seated biceps curls',
        step: { reps: 36, target: 36, at: '12.5 kg', suggest: 'try 15 kg' },
      },
      { exerciseId: 'face-pull', name: 'Face pulls', step: null },
    ],
  },
  due: { workoutId: 'workout-a', name: 'Workout A', last: 'Fri 9 Oct', summary: '7 exercises · 23 sets · ~53 min' },
}

function renderView(overrides: Partial<DashboardViewProps> = {}) {
  const props: DashboardViewProps = {
    today: 'Tue 13 Oct',
    sync: { kind: 'synced', ago: '2 min ago' },
    data: READY,
    onSync: vi.fn(),
    onOpenSettings: vi.fn(),
    onStartWorkout: vi.fn(),
    ...overrides,
  }
  render(<DashboardView {...props} />)
  return props
}

describe('DashboardView S1', () => {
  test('the header reads the day and the sync, with cloud and settings buttons', () => {
    const props = renderView()
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
    expect(screen.getByText('Tue 13 Oct · Synced 2 min ago')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(props.onSync).toHaveBeenCalledTimes(1)
  })

  test('offline, the header says the work is saved on this phone and drops the cloud button', () => {
    renderView({ sync: { kind: 'offline' } })
    expect(screen.getByText('Offline · saved on this phone')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull()
  })

  test('this week reads three KPI cards against last week', () => {
    renderView()
    // Train no longer shows the KPI tiles (O24).
    expect(screen.queryByText('This week')).toBeNull()
    expect(screen.queryByText('Sessions')).toBeNull()
    expect(screen.queryByText('Volume, kg')).toBeNull()
  })

  test('the muscle week shows sets done of planned in heat bands, the legend and the gaps', () => {
    const { container } = render(
      <DashboardView
        today="Tue 13 Oct"
        sync={{ kind: 'local' }}
        data={READY}
        onSync={vi.fn()}
        onOpenSettings={vi.fn()}
        onStartWorkout={vi.fn()}
      />,
    )
    // Train no longer shows the Muscle week (O24).
    expect(screen.queryByText('Muscle week')).toBeNull()
    expect(container.querySelector('[data-muscle]')).toBeNull()
    expect(screen.queryByText('sets / week')).toBeNull()
    expect(screen.queryByText(/No direct/)).toBeNull()
  })

  test('more than two gaps read as one list', () => {
    const { container } = render(
      <DashboardView
        today="Tue 13 Oct"
        sync={{ kind: 'local' }}
        data={READY}
        onSync={vi.fn()}
        onOpenSettings={vi.fn()}
        onStartWorkout={vi.fn()}
      />,
    )
    expect(container.querySelector('.dashboard-gaps')).toBeNull()
  })

  test('a gap muscle the program still plans sets for gets no note', () => {
    renderView()
    expect(screen.queryByText(/No direct/)).toBeNull()
  })

  test('the lifts card hints the next weight and lists each lift with its trend and change', () => {
    renderView()
    // The sparklines and the hint are gone; the due workout card lists each lift's next step.
    expect(screen.queryByRole('img', { name: /e1RM/ })).toBeNull()
    expect(screen.queryByText(/— try /)).toBeNull()
    const list = screen.getByRole('list', { name: 'Workout A lifts' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('Deadlift')).toBeTruthy()
    expect(within(rows[0]).getByText('14 of 20')).toBeTruthy()
    expect(within(rows[0]).getByText('at 70 kg')).toBeTruthy()
    const bar = within(rows[0]).getByRole('progressbar', { name: 'Deadlift 14 of 20' })
    expect(bar.getAttribute('aria-valuenow')).toBe('14')
    expect(bar.getAttribute('aria-valuemax')).toBe('20')
    expect(within(rows[1]).getByText('36 of 36 → try 15 kg')).toBeTruthy()
    expect(within(rows[2]).getByText('Face pulls')).toBeTruthy()
    expect(within(rows[2]).getByText('No sets yet')).toBeTruthy()
  })

  test('with no lifts yet the card says they come after the first workout', () => {
    renderView({ data: { ...READY, card: { ...READY.card!, lifts: [] } } })
    expect(screen.queryByText('Your lifts show here after your first workout.')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Workout A lifts' })).toBeNull()
  })

  test('the card names the workout and its duration estimate, logged or planned', () => {
    renderView()
    expect(screen.getByRole('heading', { level: 2, name: 'Workout A' })).toBeTruthy()
    expect(screen.getByText('~48 min · from your logged workouts')).toBeTruthy()
  })

  test('the heading says how many more workouts the week still plans', () => {
    renderView({ data: { ...READY, card: { ...READY.card!, more: 1 } } })
    expect(screen.getByText('next · 1 more this week')).toBeTruthy()
  })

  test('a planned estimate says so', () => {
    renderView({ data: { ...READY, card: { ...READY.card!, estimate: 'plan' } } })
    expect(screen.getByText('~48 min · planned')).toBeTruthy()
  })

  test('the dock names the workout due and starts it', () => {
    const props = renderView()
    expect(screen.getByText('Workout A due')).toBeTruthy()
    expect(screen.getByText('· last Fri 9 Oct')).toBeTruthy()
    expect(screen.getByText('7 exercises · 23 sets · ~53 min')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout A' }))
    expect(props.onStartWorkout).toHaveBeenCalledWith('workout-a')
  })
})

describe('DashboardView S8', () => {
  const options = [
    {
      id: 'ab',
      name: 'A/B Split',
      summary: '3× per week · 2 workouts · 14 exercises',
      workouts: [
        { name: 'Workout A', summary: '7 exercises · 23 sets · ~53 min' },
        { name: 'Workout B', summary: '7 exercises · 23 sets · ~48 min' },
      ],
    },
    { id: 'fb', name: 'Full body', summary: '3× per week · 1 workout · 6 exercises', workouts: [] },
  ]

  test('with no program it offers the programs, the picked one pressed, and uses it', () => {
    const onSelect = vi.fn()
    const onUse = vi.fn()
    renderView({
      sync: { kind: 'offline' },
      data: { kind: 'no-program', options, selectedId: 'ab', canUse: true, onSelect, onUse },
    })
    expect(screen.getByRole('heading', { name: 'No program yet' })).toBeTruthy()
    expect(screen.getByText('Pick a program to get a plan for every session.')).toBeTruthy()
    const ab = screen.getByRole('button', { name: /^A\/B Split 3/ })
    expect(ab.getAttribute('aria-pressed')).toBe('true')
    expect(within(ab).getByText('7 exercises · 23 sets · ~48 min')).toBeTruthy()
    expect(screen.getByText('Sessions, lifts and muscle balance fill this page after your first workout.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Full body/ }))
    expect(onSelect).toHaveBeenCalledWith('fb')
    fireEvent.click(screen.getByRole('button', { name: 'Use A/B Split' }))
    expect(onUse).toHaveBeenCalledWith('ab')
  })

  test('when nothing can be stored the program cannot be taken up', () => {
    renderView({
      data: { kind: 'no-program', options, selectedId: 'ab', canUse: false, onSelect: vi.fn(), onUse: vi.fn() },
    })
    expect((screen.getByRole('button', { name: 'Use A/B Split' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('DashboardView in the app shell', () => {
  const WORKOUTS = [
    { workoutId: 'workout-a', name: 'Workout A', last: 'Fri 9 Oct', summary: '7 exercises · 23 sets · ~53 min' },
    { workoutId: 'workout-b', name: 'Workout B', last: null, summary: '7 exercises · 23 sets · ~48 min' },
  ]

  test('Change steps the dock through the program’s workouts, and Start starts the one offered', () => {
    const props = renderView({ data: { ...READY, workouts: WORKOUTS } })
    expect(screen.getByRole('button', { name: 'Start Workout A' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Choose another workout' }))

    // Any workout but the one due drops "due" from its line.
    expect(screen.getByText('Workout B')).toBeTruthy()
    expect(screen.getByText('7 exercises · 23 sets · ~48 min')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout B' }))
    expect(props.onStartWorkout).toHaveBeenCalledWith('workout-b')

    fireEvent.click(screen.getByRole('button', { name: 'Choose another workout' }))
    expect(screen.getByText('Workout A due')).toBeTruthy()
  })

  test('a program of one workout offers no Change', () => {
    renderView({ data: { ...READY, workouts: [WORKOUTS[0]] } })
    expect(screen.queryByRole('button', { name: 'Choose another workout' })).toBeNull()
  })

  test('a Session in progress turns the dock into Resume, even before the week is worked out', () => {
    const onResume = vi.fn()
    const resume = { workoutName: 'Workout A', programName: 'A/B Split', onResume }
    const base = {
      today: 'Tue 13 Oct',
      sync: { kind: 'local' } as const,
      onSync: vi.fn(),
      onOpenSettings: vi.fn(),
      onStartWorkout: vi.fn(),
      resume,
    }
    const { rerender } = render(<DashboardView {...base} data={{ kind: 'loading' }} />)
    const button = screen.getByRole('button', { name: 'Resume Workout A' })

    rerender(<DashboardView {...base} data={READY} />)

    // The same button, kept in place as the data arrives, and no Start beside it.
    expect(screen.getByRole('button', { name: 'Resume Workout A' })).toBe(button)
    expect(screen.getByText('Workout A in progress')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Start / })).toBeNull()
    fireEvent.click(button)
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  test('the gear carries the shell’s backup-due marker and the header the shell’s trailing slot', () => {
    render(
      <ShellChromeContext.Provider value={{ settingsBadge: true, trailing: <button type="button">Update ready</button> }}>
        <DashboardView
          today="Tue 13 Oct"
          sync={{ kind: 'local' }}
          data={READY}
          onSync={vi.fn()}
          onOpenSettings={vi.fn()}
          onStartWorkout={vi.fn()}
        />
      </ShellChromeContext.Provider>,
    )
    const header = screen.getByRole('banner')
    const gear = within(header).getByRole('button', { name: 'Settings' })
    expect(within(gear).getByRole('status', { name: 'A backup is due' })).toBeTruthy()
    expect(within(header).getByRole('button', { name: 'Update ready' })).toBeTruthy()
  })

  test('notices are drawn under the header', () => {
    renderView({ notices: <p>Nothing can be saved on this phone.</p> })
    expect(screen.getByText('Nothing can be saved on this phone.').closest('.dashboard-notices')).not.toBeNull()
  })
})
