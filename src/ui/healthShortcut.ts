import type { Session } from '../types'

const SHORTCUT = 'shortcuts://run-shortcut?name=Workout%20Tracker%20to%20Health&input=text&text='

/** The setup doc for the Shortcut (E24 O31). */
export const HEALTH_SETUP_URL = 'https://github.com/assafcaf/WorkoutTracker/blob/main/docs/apple-health-shortcut.md'

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
