// Test helpers for the Dashboard's dock (Progress Dashboard S1): it offers the workout due with
// one "Start" button, and "Change" steps through the Program's other workouts in its place.
import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

type User = ReturnType<typeof userEvent.setup>

const SETTLE = { timeout: 3000 }

/** The dock's start button, once the Dashboard has loaded its Program. */
export async function findStartButton(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: /^Start / }, SETTLE)
}

/** Steps the dock to `workoutName` with "Change" and returns its start button. */
export async function offerWorkout(user: User, workoutName: string): Promise<HTMLElement> {
  const name = `Start ${workoutName}`
  await findStartButton()
  for (let step = 0; step < 10 && !screen.queryByRole('button', { name }); step += 1) {
    const change = screen.queryByRole('button', { name: 'Choose another workout' })
    if (!change) break
    await user.click(change)
  }
  return screen.findByRole('button', { name }, SETTLE)
}

/** Starts `workoutName` from the Dashboard's dock. */
export async function startFromDashboard(user: User, workoutName: string): Promise<void> {
  await user.click(await offerWorkout(user, workoutName))
}

/** Every workout the dock can start, in the order "Change" steps through them. */
export async function workoutsOffered(user: User): Promise<string[]> {
  const first = (await findStartButton()).textContent ?? ''
  const names = [first.replace(/^Start /, '')]
  const change = screen.queryByRole('button', { name: 'Choose another workout' })
  if (!change) return names
  for (let step = 0; step < 10; step += 1) {
    await user.click(change)
    const next = ((await findStartButton()).textContent ?? '').replace(/^Start /, '')
    if (next === names[0]) break
    names.push(next)
  }
  // Back where it started, as the trainee found it.
  return names
}
