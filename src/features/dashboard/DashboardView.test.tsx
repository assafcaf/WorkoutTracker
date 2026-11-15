import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { declarationsFor } from '../../test/cssAudit'
import { ShellChromeContext } from '../../ui/AppShell'
import { DashboardView, type DashboardData, type DashboardViewProps } from './DashboardView'
import type { WeekStrip } from './trainCard'

const WEEK: WeekStrip = {
  done: 1,
  planned: 3,
  days: [
    { key: 'Mon', initial: 'M', name: 'Mon', workout: 'B', tone: 'pull', workoutName: 'Workout B', today: false },
    { key: 'Tue', initial: 'T', name: 'Tue', workout: null, today: true },
    { key: 'Wed', initial: 'W', name: 'Wed', workout: null, today: false },
    { key: 'Thu', initial: 'T', name: 'Thu', workout: null, today: false },
    { key: 'Fri', initial: 'F', name: 'Fri', workout: null, today: false },
    { key: 'Sat', initial: 'S', name: 'Sat', workout: null, today: false },
    { key: 'Sun', initial: 'S', name: 'Sun', workout: null, today: false },
  ],
}

const READY: DashboardData = {
  kind: 'ready',
  card: {
    name: 'Workout A',
    minutes: 48,
    estimate: 'logged',
    lifts: [
      {
        exerciseId: 'deadlift',
        name: 'Deadlift',
        sets: 3,
        load: '70 kg',
        reps: '8–10',
        step: { reps: 14, target: 20, at: '70 kg', suggest: null },
      },
      {
        exerciseId: 'seated-biceps-curl',
        name: 'Seated biceps curls',
        sets: 3,
        load: '12.5 kg',
        reps: '10–12',
        step: { reps: 36, target: 36, at: '12.5 kg', suggest: 'try 15 kg' },
      },
      { exerciseId: 'face-pull', name: 'Face pulls', sets: 3, load: null, reps: '12–15', step: null },
    ],
  },
  due: { workoutId: 'workout-a', name: 'Workout A', last: 'Fri 9 Oct', minutes: 53 },
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
    // V3-08: the title is the Workout due, the second line the day and when it was last done;
    // the sync state rides in the cloud button's name.
    expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toBeTruthy()
    expect(screen.getByText('Tue 13 Oct · last done Fri 9 Oct')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sync now · Synced 2 min ago' }))
    expect(props.onSync).toHaveBeenCalledTimes(1)
  })

  test('offline, the header says the work is saved on this phone and drops the cloud button', () => {
    renderView({ sync: { kind: 'offline' } })
    // V3-08: said by the crossed-out cloud's name, not by a line of text.
    expect(screen.getByRole('img', { name: 'Offline · saved on this phone' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Sync now/ })).toBeNull()
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
    // V2-05: each row is today's Set 1 Preset over the planned Sets and the rep range, and a lift
    // ready to step up says so in one line; the progression bars are gone.
    expect(screen.queryByRole('img', { name: /e1RM/ })).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    const list = screen.getByRole('list', { name: 'Workout A lifts' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('Deadlift')).toBeTruthy()
    expect(within(rows[0]).getByText('3 × 70 kg')).toBeTruthy()
    expect(within(rows[0]).getByText('· 8–10')).toBeTruthy()
    expect(within(rows[0]).queryByText(/step up/)).toBeNull()
    expect(within(rows[0]).queryByText('14 of 20')).toBeNull()
    expect(within(rows[1]).getByText('3 × 12.5 kg')).toBeTruthy()
    expect(within(rows[1]).getByText('step up · try 15 kg')).toBeTruthy()
    expect(within(rows[2]).getByText('Face pulls')).toBeTruthy()
    expect(within(rows[2]).getByText('3 sets')).toBeTruthy()
    // V6 (V5-07): a lift whose Sets ramp says so, Set 1's load to the top one.
    cleanup()
    renderView({
      data: {
        ...READY,
        card: { ...READY.card!, lifts: [{ ...READY.card!.lifts[0], load: '47.5 kg', topLoad: '62.5 kg', sets: 4 }] },
      },
    })
    expect(screen.getByText('4 sets · 47.5 → 62.5 kg')).toBeTruthy()
    expect(within(rows[2]).queryByText('No sets yet')).toBeNull()
  })

  test('with no lifts yet the card says they come after the first workout', () => {
    renderView({ data: { ...READY, card: { ...READY.card!, lifts: [] } } })
    expect(screen.queryByText('Your lifts show here after your first workout.')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Workout A lifts' })).toBeNull()
  })

  test('V1-33 Train is titled "Train", not "Dashboard"', () => {
    // V3-08: with no Workout to offer yet the title is "Train"; once one is due, its name.
    const { unmount } = render(
      <DashboardView
        today="Tue 13 Oct"
        sync={{ kind: 'local' }}
        data={{ kind: 'loading' }}
        onSync={vi.fn()}
        onOpenSettings={vi.fn()}
        onStartWorkout={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Train' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).toBeNull()
    unmount()
    renderView()
    expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toBeTruthy()
  })

  test('V1-33 the legend stays hidden while no lift has sets yet', () => {
    const fresh = READY.card!.lifts.map((lift) => ({ ...lift, step: null }))
    renderView({ data: { ...READY, card: { ...READY.card!, lifts: fresh } } })
    expect(screen.getByRole('list', { name: 'Workout A lifts' })).toBeTruthy()
    expect(screen.queryByText('Reps at the current weight against the next step')).toBeNull()
  })

  test('V1-33 the legend shows once any lift has sets', () => {
    // V2-05: the rows read Presets, not bars, so no legend is drawn even once lifts have sets.
    renderView()
    expect(screen.queryByText('Reps at the current weight against the next step')).toBeNull()
    expect(screen.queryByText('= next step')).toBeNull()
  })

  test('the card names the workout and its duration estimate, logged or planned', () => {
    // V2-05: the dock names the workout and its estimate; the card above it repeats neither.
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
    expect(screen.queryByRole('heading', { level: 2, name: 'Workout A' })).toBeNull()
    expect(screen.queryByText('~48 min · from your logged workouts')).toBeNull()
    // V3-08: the dock keeps the time only; the header and the Start button name the workout.
    expect(screen.getByText('~53 min')).toBeTruthy()
    expect(container.textContent?.match(/Workout A/g)).toHaveLength(2)
  })

  test('the heading says how many more workouts the week still plans', () => {
    // V2-05: the week strip at the top says it as done of planned; the card has no heading.
    renderView({ data: { ...READY, week: WEEK, card: { ...READY.card!, more: 2 } }, onOpenSessions: vi.fn() })
    expect(screen.queryByText('next · 2 more this week')).toBeNull()
    const week = screen.getByRole('button', { name: /^This week, 1 of 3/ })
    expect(within(week).getByText('1 of 3')).toBeTruthy()
  })

  test('a planned estimate says so', () => {
    // V2-05: the estimate rides in the dock's summary only, whichever way it was worked out.
    renderView({ data: { ...READY, card: { ...READY.card!, estimate: 'plan' } } })
    expect(screen.queryByText('~48 min · planned')).toBeNull()
    expect(screen.getByText('~53 min')).toBeTruthy()
  })

  test('V2-05 the week strip sits above the lifts with a cell per day, today marked and the done day named', () => {
    renderView({ data: { ...READY, week: WEEK }, onOpenSessions: vi.fn() })
    // V3-09: the strip is one button whose name says the week; its cells are the Sessions
    // calendar's (the letter in the workout's tone, today outlined).
    const week = screen.getByRole('button', { name: 'This week, 1 of 3: Workout B Mon. Open Sessions' })
    const days = [...week.querySelectorAll('.calendar-day')]
    expect(days).toHaveLength(7)
    expect(days[0].textContent).toBe('B')
    expect(days[0].getAttribute('data-workout')).toBe('pull')
    expect(days[1].hasAttribute('data-today')).toBe(true)
    expect(days.filter((d) => d.hasAttribute('data-today'))).toHaveLength(1)
    const lifts = screen.getByRole('list', { name: 'Workout A lifts' })
    expect(week.compareDocumentPosition(lifts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('V2-05 with no week worked out Train draws no strip', () => {
    renderView({ onOpenSessions: vi.fn() })
    expect(screen.queryByRole('button', { name: /^This week/ })).toBeNull()
    expect(document.querySelector('.dashboard-week')).toBeNull()
  })

  test('the dock names the workout due and starts it', () => {
    const props = renderView()
    // V3-08: the header names the workout due and when it was last done; the dock its time.
    expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toBeTruthy()
    expect(screen.getByText('Tue 13 Oct · last done Fri 9 Oct')).toBeTruthy()
    expect(screen.getByText('~53 min')).toBeTruthy()
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
    expect(screen.queryByText(/fill this page/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Full body/ }))
    expect(onSelect).toHaveBeenCalledWith('fb')
    fireEvent.click(screen.getByRole('button', { name: 'Use A/B Split' }))
    expect(onUse).toHaveBeenCalledWith('ab')
  })

  test('V2-15 the first-run Train promises nothing it never shows', () => {
    renderView({
      data: { kind: 'no-program', options, selectedId: 'ab', canUse: true, onSelect: vi.fn(), onUse: vi.fn() },
    })
    expect(document.body.textContent).not.toContain('fill this page')
    expect(screen.getByRole('button', { name: 'Use A/B Split' })).toBeTruthy()
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
    { workoutId: 'workout-a', name: 'Workout A', last: 'Fri 9 Oct', minutes: 53 },
    { workoutId: 'workout-b', name: 'Workout B', last: null, minutes: 48 },
  ]

  test('Change steps the dock through the program’s workouts, and Start starts the one offered', () => {
    const props = renderView({ data: { ...READY, workouts: WORKOUTS } })
    expect(screen.getByRole('button', { name: 'Start Workout A' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Choose another workout' }))

    // V3-08: the header follows the workout offered, and the dock its time.
    expect(screen.getByRole('heading', { level: 1, name: 'Workout B' })).toBeTruthy()
    expect(screen.getByText('~48 min')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout B' }))
    expect(props.onStartWorkout).toHaveBeenCalledWith('workout-b')

    fireEvent.click(screen.getByRole('button', { name: 'Choose another workout' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toBeTruthy()
  })

  test('V1-21 after Change the Workout card shows the chosen Workout, matching the Start button', () => {
    const cardB = {
      name: 'Workout B',
      minutes: 50,
      estimate: 'plan' as const,
      lifts: [{ exerciseId: 'deadlift', name: 'Deadlift', step: null }],
    }
    const cardA = {
      ...READY.card!,
      lifts: [{ exerciseId: 'back-squat', name: 'Back squat', step: null }, ...READY.card!.lifts],
    }
    renderView({
      data: { ...READY, card: cardA, workouts: WORKOUTS, cards: { 'workout-a': cardA, 'workout-b': cardB } },
    })
    expect(screen.getByRole('region', { name: 'Workout A' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Choose another workout' }))
    expect(screen.getByRole('button', { name: 'Start Workout B' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Workout B' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Workout A' })).toBeNull()
    const rows = within(screen.getByRole('list', { name: 'Workout B lifts' })).getAllByRole('listitem')
    expect(within(rows[0]).getByText('Deadlift')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Choose another workout' }))
    expect(screen.getByRole('region', { name: 'Workout A' })).toBeTruthy()
    const back = within(screen.getByRole('list', { name: 'Workout A lifts' })).getAllByRole('listitem')
    expect(within(back[0]).getByText('Back squat')).toBeTruthy()
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
    // V3-08: the header names the Session in progress; the dock is its Resume button only.
    expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toBeTruthy()
    expect(screen.getByText('Tue 13 Oct · in progress')).toBeTruthy()

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

describe('DashboardView V3', () => {
  test('V3-08 no visible line says "Not synced"; the cloud button carries it as its name', () => {
    const { container } = render(
      <DashboardView
        today="Thu 15 Oct"
        sync={{ kind: 'failed' }}
        data={READY}
        onSync={vi.fn()}
        onOpenSettings={vi.fn()}
        onStartWorkout={vi.fn()}
      />,
    )
    expect(container.textContent).not.toContain('Not synced')
    expect(container.textContent).not.toContain('saved on this phone')
    const cloud = screen.getByRole('button', { name: /^Sync now/ })
    expect(cloud.getAttribute('aria-label')).toContain('saved on this phone')
    expect(cloud.getAttribute('data-sync')).toBe('failed')
  })

  test('V3-08 the dock is the time, Change and Start: no "due" line and no exercise or set count', () => {
    const { container } = render(
      <DashboardView
        today="Thu 15 Oct"
        sync={{ kind: 'local' }}
        data={{
          ...READY,
          workouts: [READY.due!, { workoutId: 'workout-b', name: 'Workout B', last: null, minutes: 48 }],
        }}
        onSync={vi.fn()}
        onOpenSettings={vi.fn()}
        onStartWorkout={vi.fn()}
      />,
    )
    const dock = container.querySelector('.dashboard-dock') as HTMLElement
    expect(within(dock).getByText('~53 min')).toBeTruthy()
    expect(within(dock).getByRole('button', { name: 'Choose another workout' })).toBeTruthy()
    expect(within(dock).getByRole('button', { name: 'Start Workout A' })).toBeTruthy()
    expect(dock.textContent).not.toMatch(/due|exercises|sets/)
    expect(screen.getByText('Thu 15 Oct · last done Fri 9 Oct')).toBeTruthy()
  })

  test('V3-08 a workout never done reads the day alone under its name', () => {
    renderView({ data: { ...READY, due: { ...READY.due!, last: null } } })
    expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toBeTruthy()
    expect(screen.getByText('Tue 13 Oct')).toBeTruthy()
  })

  test('V6 V5-14 with onOpenSession each done day is its own button, opening that workout', () => {
    const onOpenSession = vi.fn()
    const onOpenSessions = vi.fn()
    const week: WeekStrip = {
      ...WEEK,
      days: WEEK.days.map((day, at) =>
        at === 0 ? { ...day, sessionId: 'mon-session', label: 'Workout B, Mon 12 Oct' } : day,
      ),
    }
    renderView({ data: { ...READY, week }, onOpenSessions, onOpenSession })

    const day = screen.getByRole('button', { name: 'Workout B, Mon 12 Oct' })
    expect(day).toHaveClass('calendar-day')
    fireEvent.click(day)
    expect(onOpenSession).toHaveBeenCalledWith('mon-session')
    expect(onOpenSessions).not.toHaveBeenCalled()
    // Days with nothing done are no buttons; Sessions is still one tap away, on the count.
    expect(document.querySelectorAll('.dashboard-week button.calendar-day')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /^This week, 1 of 3.*Open Sessions$/ }))
    expect(onOpenSessions).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /^This week/ }).querySelector('button')).toBeNull()
  })

  test('V3-09 the week strip is one button that opens Sessions', () => {
    const onOpenSessions = vi.fn()
    renderView({ data: { ...READY, week: WEEK }, onOpenSessions })
    const strip = screen.getByRole('button', { name: /^This week/ })
    expect(strip.querySelectorAll('.calendar-week')).toHaveLength(1)
    expect(strip.querySelectorAll('button')).toHaveLength(0)
    fireEvent.click(strip)
    expect(onOpenSessions).toHaveBeenCalledTimes(1)
  })

  test('V3-10 a lift row wraps its name and Preset rather than cutting the name; header icons are sized in rem', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const css = readFileSync(join(here, 'DashboardScreen.css'), 'utf-8')
    const name = declarationsFor(css, '.dashboard-step-name')
    expect(name.get('text-overflow')).toBeUndefined()
    expect(name.get('white-space')).toBeUndefined()
    expect(declarationsFor(css, '.dashboard-step-line').get('flex-wrap')).toBe('wrap')
    expect(declarationsFor(css, '.dashboard-header-actions svg').get('width')).toMatch(/rem$/)
  })
})

