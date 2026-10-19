import type { Session } from '../types'

const SHORTCUT = 'shortcuts://run-shortcut?name=Workout%20Tracker%20to%20Health&input=text&text='

/** The setup doc for the Shortcut (E24 O31). */
export const HEALTH_SETUP_URL = 'https://github.com/assafcaf/WorkoutTracker/blob/main/docs/apple-health-shortcut.md'

/** The exact name of the Shortcut the trainee builds (E25 O1). */
export const HEALTH_SHORTCUT_NAME = 'Workout Tracker to Health'

/** localStorage key: the trainee confirmed the Shortcut is set up on this device (E25 O2). */
export const HEALTH_READY_KEY = 'healthShortcutReady'

export interface HealthShortcutStep {
  /** The step as the guide shows it. */
  text: string
  /** A phrase of the step that `docs/apple-health-shortcut.md` also contains (E25 O4). */
  key: string
}

export const HEALTH_SHORTCUT_STEPS: readonly HealthShortcutStep[] = []

export function readHealthReady(): boolean {
  return false
}

export function markHealthReady(): void {}

/**
 * The Shortcuts URL that runs `Workout Tracker to Health` with the Workout's name, start, end
 * (ISO 8601) and rounded minutes as JSON text input (E24 O30).
 */
export function healthShortcutUrl(session: Session, workoutName: string): string {
  const end = session.finishedAt ?? session.startedAt
  const payload = {
    workout: workoutName,
    start: new Date(session.startedAt).toISOString(),
    end: new Date(end).toISOString(),
    minutes: Math.round((end - session.startedAt) / 60_000),
  }
  return SHORTCUT + encodeURIComponent(JSON.stringify(payload))
}
