// The number and date words every stats sentence is built from (R-C). Pure. `copy.ts` re-exports
// them, so its callers keep their imports; `liftStatus.ts` and `liftStory.ts` read them here.
//
//   numberText(n)                 -> '62.5' (at most 2 decimals, no trailing zeros)
//   leverText(lever, bodyweight)  -> '62.5 kg' | 'BW' | 'BW+5' | 'BW−19' (U+2212)
//   topText(top, bodyweight)      -> '13 kg × 9' | 'BW × 15'
//   humanDate(ms)                 -> 'Wed 14 Oct' (local time, no year)
//   dayMonth(ms)                  -> '14 Oct'

const MINUS = '−'
const TIMES = '×'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A number with at most 2 decimals, no trailing zeros. */
export function numberText(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** `Wed` for a timestamp, local time. */
export function weekdayName(ms: number): string {
  return DAYS[new Date(ms).getDay()]
}

export function leverText(lever: number, bodyweight: boolean): string {
  if (!bodyweight) return `${numberText(lever)} kg`
  if (lever === 0) return 'BW'
  return lever > 0 ? `BW+${numberText(lever)}` : `BW${MINUS}${numberText(-lever)}`
}

export function topText(top: { lever: number; reps: number }, bodyweight: boolean): string {
  return `${leverText(top.lever, bodyweight)} ${TIMES} ${top.reps}`
}

export function humanDate(ms: number): string {
  const d = new Date(ms)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** `14 Oct`: a day without its weekday. */
export function dayMonth(ms: number): string {
  const d = new Date(ms)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** `3 sessions`, `1 session`. */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
