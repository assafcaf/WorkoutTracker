// Test helpers for starting a workout. v7: the app opens on Home, whose dock starts the workout
// due; Home's Today panel (or its "Next" row) opens the workout page, whose dock offers the due
// workout with one "Start" button and steps through the Program's others with the › arrow beside
// its title ("Next workout: <name>").
import { screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

type User = ReturnType<typeof userEvent.setup>

const SETTLE = { timeout: 3000 }

/** The workout page, if it is on screen. */
function workoutPage(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.dashboard')
}

/** The workout page's › arrow ("Next workout: Workout B"), if it is on screen. */
function changeButton(): HTMLElement | null {
  const page = workoutPage()
  return page ? within(page).queryByRole('button', { name: /^Next workout: / }) : null
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
  if (workoutPage()) return false
  const door = await screen.findByRole('button', { name: /Open the workout\.$/ }, SETTLE).catch(() => null)
  if (!door || workoutPage()) return false
  await user.click(door)
  return true
}

/** Steps the workout page to `workoutName` with its › arrow and returns its start button. */
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

/** Every workout the workout page can start, in the order its › arrow steps through them. */
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
