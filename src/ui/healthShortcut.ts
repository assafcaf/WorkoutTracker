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

/** The Shortcut's build steps; `docs/apple-health-shortcut.md` "Build it" says the same (E25 O4). */
export const HEALTH_SHORTCUT_STEPS: readonly HealthShortcutStep[] = [
  {
    text: `Open Shortcuts, tap +, and name the Shortcut ${HEALTH_SHORTCUT_NAME} (the name must match, including the capitals).`,
    key: HEALTH_SHORTCUT_NAME,
  },
  { text: "In the Shortcut's settings, set it to accept Text as its input.", key: 'as its input' },
  { text: 'Add Get Dictionary from Input (input: Shortcut Input).', key: 'Get Dictionary from Input' },
  {
    text: 'Add Get Dictionary Value for workout, then again for start, end and minutes.',
    key: 'Get Dictionary Value',
  },
  {
    text: 'Add Get Dates from Input on start and again on end, to turn the text into dates.',
    key: 'Get Dates from Input',
  },
  {
    text: 'Add Log Workout: type Traditional Strength Training, Duration the minutes value in minutes, Start Date the start date, End Date the end date.',
    key: 'Traditional Strength Training',
  },
  { text: 'Run it once from the Shortcuts app to allow it to write to Health.', key: 'Run it once from the Shortcuts app' },
]

export function readHealthReady(): boolean {
  try {
    return localStorage.getItem(HEALTH_READY_KEY) !== null
  } catch {
    return false
  }
}

export function markHealthReady(): void {
  try {
    localStorage.setItem(HEALTH_READY_KEY, '1')
  } catch {
    // storage unavailable: the guide simply stays unconfirmed
  }
}

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
