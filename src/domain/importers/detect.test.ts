import { describe, expect, it } from 'vitest'
import { detectFormat } from './detect'

const STRONG_NEW = ['Date', 'Workout Name', 'Duration', 'Exercise Name', 'Set Order', 'Weight', 'Reps', 'Distance', 'Seconds', 'Notes', 'Workout Notes', 'RPE']
const STRONG_OLD = ['Date', 'Workout Name', 'Exercise Name', 'Set Order', 'Weight', 'Weight Unit', 'Reps', 'RPE']
const HEVY = ['title', 'start_time', 'end_time', 'description', 'exercise_title', 'superset_id', 'exercise_notes', 'set_index', 'set_type', 'weight_kg', 'reps', 'distance_km', 'duration_seconds', 'rpe']
const OWN = ['date', 'program', 'workout', 'exercise', 'set index', 'kind', 'weight kg', 'reps', 'rir', 'e1RM', 'session note']

describe('detectFormat (O8)', () => {
  it('O8: a header with Exercise Name and Set Order is strong', () => {
    expect(detectFormat(STRONG_NEW)).toBe('strong')
  })
  it('O8: the older semicolon-era Strong header is strong too', () => {
    expect(detectFormat(STRONG_OLD)).toBe('strong')
  })
  it('O8: a header with exercise_title and start_time is hevy, in any column order', () => {
    expect(detectFormat(HEVY)).toBe('hevy')
    expect(detectFormat([...HEVY].reverse())).toBe('hevy')
  })
  it('O8: the app own sets CSV is null', () => {
    expect(detectFormat(OWN)).toBeNull()
  })
  it('O8: a JSON backup first line, split as cells, is null', () => {
    expect(detectFormat(['{"schemaVersion":1', '"sessions":[]'])).toBeNull()
  })
  it('O8: an empty header is null', () => {
    expect(detectFormat([])).toBeNull()
  })
  it('O8: only half of the Strong columns is null', () => {
    expect(detectFormat(['Date', 'Exercise Name', 'Weight'])).toBeNull()
    expect(detectFormat(['Date', 'Set Order', 'Weight'])).toBeNull()
  })
  it('O8: only half of the Hevy columns is null', () => {
    expect(detectFormat(['title', 'exercise_title', 'weight_kg'])).toBeNull()
    expect(detectFormat(['title', 'start_time', 'weight_kg'])).toBeNull()
  })
})
