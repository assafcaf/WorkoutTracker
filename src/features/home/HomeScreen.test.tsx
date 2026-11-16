// v7 Home (docs/design/competitors-2026-11/home/home.md §6): each block's tap target, the dock in
// each moment, the new trainee's plan pick, and Resume during a live Session. HomeView is drawn
// from the real model (`homeModelOf`) over the stats Sessions at the design's clocks.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { Session } from '../../types'
import { homeModelOf, type HomeModel } from './homeModel'
import { HomeView, type HomeActions, type HomeResume } from './HomeScreen'

process.env.TZ = 'Asia/Jerusalem'

const sessions = sessionsJson as unknown as Session[]
const catalog = loadCatalog()
const programs = loadPrograms()
const program = programs.find((p) => p.id === 'assaf-ab-2026')!
const resolve = (id: string) => catalog.get(id)

const TRAINING = new Date(2026, 9, 16, 7, 40).getTime()
const REST = new Date(2026, 9, 15, 18, 5).getTime()
const BREAK = new Date(2026, 10, 9, 7, 40).getTime()
const DONE = new Date(2026, 9, 14, 19, 20).getTime()

afterEach(cleanup)

function modelAt(now: number, newUser = false): HomeModel {
  return homeModelOf({
    program: newUser ? null : program,
    programs,
    sessions: newUser ? [] : sessions.filter((s) => s.startedAt <= now),
    resolve,
    now,
    weekStartsOn: 1,
    reminders: null,
    live: false,
  })
}

function draw(model: HomeModel, resume: HomeResume | null = null): HomeActions {
  const actions: HomeActions = {
    onStartWorkout: vi.fn(),
    onPickPlan: vi.fn(),
    onOpenToday: vi.fn(),
    onOpenSession: vi.fn(),
    onOpenSessions: vi.fn(),
    onOpenProgress: vi.fn(),
    onOpenLift: vi.fn(),
    onOpenSettings: vi.fn(),
  }
  render(<HomeView model={model} date={model.date} resume={resume} canStart {...actions} />)
  return actions
}

describe('Home: the training day (a)', () => {
  test('the Today panel names the workout and the change, and opens the workout page', () => {
    const actions = draw(modelAt(TRAINING))
    const today = screen.getByRole('button', { name: /^Today: Workout B\./ })
    expect(today).toHaveAccessibleName(/7 lifts · about 66 min/)
    expect(today).toHaveAccessibleName(/Up: Curls up to 15 kg/)
    expect(within(today).getByRole('img', { name: '2 of 3 sessions this week' })).toBeTruthy()
    fireEvent.click(today)
    expect(actions.onOpenToday).toHaveBeenCalledTimes(1)
  })

  test('the Lifts block opens Progress, and one line opens its lift', () => {
    const actions = draw(modelAt(TRAINING))
    fireEvent.click(screen.getByRole('button', { name: 'Lifts, 12 weeks: 12 of 14 moving. Open Progress.' }))
    expect(actions.onOpenProgress).toHaveBeenCalledTimes(1)
    const rowA = screen.getByRole('group', { name: 'Workout A lifts' })
    expect(within(rowA).getAllByRole('button')).toHaveLength(7)
    fireEvent.click(within(rowA).getByRole('button', { name: 'Back squat: moving' }))
    expect(actions.onOpenLift).toHaveBeenCalledWith('back-squat')
    expect(screen.getByRole('button', { name: 'Narrow-grip pull-down: lowered' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'DB bench press: flat' })).toBeTruthy()
  })

  test('the Sessions block draws 12 weeks and opens Sessions', () => {
    const actions = draw(modelAt(TRAINING))
    const block = screen.getByRole('button', { name: 'Sessions: 30 in the last 12 weeks. Open Sessions.' })
    expect(within(block).getByRole('img', { name: '30 sessions in the last 12 weeks' })).toBeTruthy()
    fireEvent.click(block)
    expect(actions.onOpenSessions).toHaveBeenCalledTimes(1)
  })

  test('Last time opens that Session, and the dock starts Workout B on an ink bar', () => {
    const actions = draw(modelAt(TRAINING))
    const last = screen.getByRole('button', { name: /^Last time: Workout A, Wed 14 Oct, 71 min\. 5 of 7 lifts up, 4 PRs/ })
    fireEvent.click(last)
    expect(actions.onOpenSession).toHaveBeenCalledWith('seed-44')
    const start = screen.getByRole('button', { name: 'Start Workout B' })
    expect(start).not.toHaveAttribute('data-style', 'outline')
    fireEvent.click(start)
    expect(actions.onStartWorkout).toHaveBeenCalledWith('workout-b')
  })
})

describe('Home: the other moments', () => {
  test('(b) a rest day says On track and keeps Start as an outline', () => {
    draw(modelAt(REST))
    expect(screen.getByRole('button', { name: /^Rest day: On track\. Next: Workout B, Friday\./ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start Workout B' })).toHaveAttribute('data-style', 'outline')
  })

  test('(c) after a break: welcome back, the lines as you left them, Last time with no verdict', () => {
    draw(modelAt(BREAK))
    expect(screen.getByRole('button', { name: /^Welcome back: Workout B\. 26 days off/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lifts, 12 weeks: As you left them. Open Progress.' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Last time: Workout A, Wed 14 Oct, 26 days ago. Open its summary.' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start Workout B' })).toBeTruthy()
  })

  test('(d) just finished: the panel opens the summary, the Next row the workout page, and no Start', () => {
    const actions = draw(modelAt(DONE))
    const today = screen.getByRole('button', { name: /^Done today: Workout A\. 71 min · 24 sets\. Up: 5 of 7 lifts\. 4 PRs/ })
    expect(today).toHaveAccessibleName(/Open its summary\.$/)
    fireEvent.click(today)
    expect(actions.onOpenSession).toHaveBeenCalledWith('seed-44')
    expect(screen.getAllByRole('button', { name: /PR today$/ })).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Next: Workout B, Friday. Open the workout.' }))
    expect(actions.onOpenToday).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /^Start / })).toBeNull()
  })

  test('(e) a new trainee picks a plan and the dock starts its first workout', () => {
    const actions = draw(modelAt(TRAINING, true))
    expect(screen.getByRole('heading', { name: 'Pick a plan' })).toBeTruthy()
    const first = screen.getByRole('radio', { name: /^A\/B Split/ })
    expect(first).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Start Workout A' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /^Upper\/Lower/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Start Upper' }))
    expect(actions.onPickPlan).toHaveBeenCalledWith('upper-lower', 'upper')
    expect(screen.getByRole('img', { name: '0 sessions in the last 12 weeks' })).toBeTruthy()
    expect(screen.getByText('Each lift draws its line after 4 sessions.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Last time/ })).toBeNull()
  })

  test('during a live Session the Today panel is the Resume card and the dock reads Resume', () => {
    const onResume = vi.fn()
    draw(modelAt(TRAINING), { workoutName: 'Workout A', programName: 'A/B Split', onResume })
    expect(screen.queryByRole('button', { name: /^Today:/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Resume Workout A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(onResume).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: /^Start / })).toBeNull()
  })
})
