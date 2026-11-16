// Test helpers for starting a workout. v7: the app opens on Home, whose dock starts the workout
// due; Home's Today panel (or its "Next" row) opens the workout page, whose dock offers the due
// workout with one "Start" button and steps through the Program's others with "Do <name> instead".
import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

type User = ReturnType<typeof userEvent.setup>

const SETTLE = { timeout: 3000 }

/** The "Do Workout B instead" control of the workout page's dock, if it is on screen. */
function changeButton(): HTMLElement | null {
  return screen.queryByRole('button', { name: /^Do .+ instead$/ })
}

/** The dock's start button, once Home or the workout page has loaded its Program. */
export async function findStartButton(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: /^Start / }, SETTLE)
}

/**
 * On Home, opens the workout page from the Today panel (or, just after a Session, from the
 * "Next" row); on the workout page already, does nothing.
 */
export async function openWorkoutPage(user: User): Promise<boolean> {
  if (changeButton()) return false
  const door = await screen.findByRole('button', { name: /Open the workout\.$/ }, SETTLE).catch(() => null)
  if (!door || changeButton()) return false
  await user.click(door)
  return true
}

/** Steps the dock to `workoutName` with "Do … instead" and returns its start button. */
export async function offerWorkout(user: User, workoutName: string): Promise<HTMLElement> {
  const name = `Start ${workoutName}`
  if (!screen.queryByRole('button', { name })) await openWorkoutPage(user)
  await findStartButton()
  for (let step = 0; step < 10 && !screen.queryByRole('button', { name }); step += 1) {
    const change = changeButton()
    if (!change) break
    await user.click(change)
  }
  return screen.findByRole('button', { name }, SETTLE)
}

/** Starts `workoutName` from the dock (Home's, or the workout page's). */
export async function startFromDashboard(user: User, workoutName: string): Promise<void> {
  await user.click(await offerWorkout(user, workoutName))
}

/** Every workout the workout page can start, in the order "Do … instead" steps through them. */
export async function workoutsOffered(user: User): Promise<string[]> {
  const opened = await openWorkoutPage(user)
  // The workout page loads its own data: wait for its dock, not Home's.
  if (opened) await screen.findByRole('button', { name: 'Back' }, SETTLE)
  const first = (await findStartButton()).textContent ?? ''
  const names = [first.replace(/^Start /, '')]
  for (let step = 0; step < 10; step += 1) {
    const change = changeButton()
    if (!change) break
    await user.click(change)
    const next = ((await findStartButton()).textContent ?? '').replace(/^Start /, '')
    if (next === names[0]) break
    names.push(next)
  }
  // Back where it started, as the trainee found it: on Home if it opened the workout page.
  if (opened) await user.click(screen.getByRole('button', { name: 'Back' }))
  return names
}
