export function lbsToKg(n: number): number {
  return Math.round(n * 0.45359237 * 10) / 10
}

export function rirFromRpe(rpe: number | null | undefined): number | undefined {
  if (rpe == null || !Number.isFinite(rpe) || rpe <= 0) return undefined
  return Math.min(3, Math.max(0, Math.ceil(10 - rpe)))
}
