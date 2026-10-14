import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ShellChromeContext } from '../../ui/AppShell'
import { DashboardView, type DashboardData, type DashboardViewProps } from './DashboardView'

const READY: DashboardData = {
  kind: 'ready',
  sessionsPerWeek: 3,
  thisWeek: { sessions: 1, sets: 23, volumeKg: 8920 },
  lastWeek: { sessions: 3, sets: 75, volumeKg: 27240 },
  muscles: [
    { muscle: 'chest', done: 7, planned: 7 },
    { muscle: 'lats', done: 11, planned: 22 },
    { muscle: 'quadriceps', done: 6.5, planned: 7.5 },
    { muscle: 'calves', done: 0, planned: 0 },
  ],
  gaps: ['calves', 'abdominals'],
  lifts: [
    { exerciseId: 'back-squat', name: 'Back squat', values: [66.7, 68, 70, 72, 74.2], latest: 74.2, delta: 7.5 },
    { exerciseId: 'db-bench-press', name: 'DB bench press', values: [14.8], latest: 14.8, delta: null },
  ],
  hint: { name: 'Back squat', nextWeightKg: 62.5 },
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
    expect(screen.getByText('1/3')).toBeTruthy()
    expect(screen.getByText('vs 3')).toBeTruthy()
    expect(screen.getByText('23')).toBeTruthy()
    expect(screen.getByText('vs 75')).toBeTruthy()
    expect(screen.getByText('8,920')).toBeTruthy()
    expect(screen.getByText('vs 27,240')).toBeTruthy()
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
    const lats = container.querySelector('[data-muscle="lats"]') as HTMLElement
    expect(within(lats).getByText('Lats')).toBeTruthy()
    expect(within(lats).getByText('11').getAttribute('data-band')).toBe('2')
    expect(within(lats).getByText('of 22')).toBeTruthy()
    const quads = container.querySelector('[data-muscle="quadriceps"]') as HTMLElement
    expect(within(quads).getByText('Quads')).toBeTruthy()
    expect(within(quads).getByText('7').getAttribute('data-band')).toBe('1')
    expect(within(quads).getByText('of 8')).toBeTruthy()
    expect(screen.getByText('sets / week')).toBeTruthy()
    expect(screen.getByText('No direct calves work')).toBeTruthy()
    expect(screen.getByText('No direct abdominals work')).toBeTruthy()
  })

  test('more than two gaps read as one list', () => {
    renderView({ data: { ...READY, gaps: ['middle back', 'glutes', 'calves'] } })
    const notes = ['No direct middle back work', 'No direct glutes work', 'No direct calves work'].map((text) =>
      screen.getByText(text),
    )
    const list = notes[0].parentElement as HTMLElement
    expect(list).toHaveClass('dashboard-gaps')
    for (const note of notes) expect(note.parentElement).toBe(list)
  })

  test('a gap muscle the program still plans sets for gets no note', () => {
    renderView({
      data: {
        ...READY,
        muscles: [...READY.muscles, { muscle: 'hamstrings', done: 7, planned: 10 }],
        gaps: ['hamstrings', 'calves'],
      },
    })
    expect(screen.queryByText(/hamstrings/)).toBeNull()
    expect(screen.getByText('No direct calves work')).toBeTruthy()
  })

  test('the lifts card hints the next weight and lists each lift with its trend and change', () => {
    renderView()
    expect(screen.getByText('Back squat — try 62.5 kg')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Back squat e1RM' })).toBeTruthy()
    expect(screen.getByText('74.2')).toBeTruthy()
    expect(screen.getByText('+7.5')).toBeTruthy()
    expect(screen.getByText('14.8')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })

  test('with no lifts yet the card says they come after the first workout', () => {
    renderView({ data: { ...READY, lifts: [], hint: null } })
    expect(screen.getByText('Your lifts show here after your first workout.')).toBeTruthy()
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
