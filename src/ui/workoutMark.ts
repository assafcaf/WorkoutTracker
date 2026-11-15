/**
 * The data tokens a Workout takes by its index in its Program, cycling (E22-T6, O15); `gone`
 * when the Workout no longer exists.
 */
export type WorkoutTone = 'push' | 'pull' | 'legs' | 'core' | 'gone'

const WORKOUT_TONES = ['push', 'pull', 'legs', 'core'] as const

/** A Workout's colour key by its index in its Program, cycling; `gone` for a missing one (-1). */
export function workoutToneAt(index: number): WorkoutTone {
  return index < 0 ? 'gone' : WORKOUT_TONES[index % WORKOUT_TONES.length]
}

/**
 * The one letter a calendar day prints for its Workout (V1-29), so A and B differ by more than
 * hue: the name's last word when it is a single letter or digit ("Workout A" -> A), else the
 * name's first letter.
 */
export function workoutLetterOf(name: string): string {
  const last = name.trim().split(/\s+/).pop() ?? ''
  if (/^[\p{L}\p{N}]$/u.test(last)) return last.toUpperCase()
  return (name.trim().charAt(0) || '?').toUpperCase()
}
