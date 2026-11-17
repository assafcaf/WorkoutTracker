// Test helper: synthetic pose landmarks (not a test file).
import { POSE } from './distance'
import type { Landmark } from './distance'

/** A standing body `s` times the size of the reference one, all landmarks seen. */
export function body(s: number, over: Partial<Record<number, Partial<Landmark>>> = {}): Landmark[] {
  const marks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))
  const at = (i: number, x: number, y: number): void => {
    marks[i] = { x, y, visibility: 1 }
  }
  at(POSE.nose, 0.5, 0.2 - 0.1 * s)
  at(POSE.leftShoulder, 0.45, 0.2)
  at(POSE.rightShoulder, 0.55, 0.2)
  at(POSE.leftHip, 0.47, 0.2 + 0.2 * s)
  at(POSE.rightHip, 0.53, 0.2 + 0.2 * s)
  at(POSE.leftAnkle, 0.47, 0.2 + 0.6 * s)
  at(POSE.rightAnkle, 0.53, 0.2 + 0.6 * s)
  at(POSE.leftHeel, 0.47, 0.22 + 0.6 * s)
  at(POSE.rightHeel, 0.53, 0.22 + 0.6 * s)
  at(POSE.leftFoot, 0.46, 0.23 + 0.6 * s)
  at(POSE.rightFoot, 0.54, 0.23 + 0.6 * s)
  for (const [i, patch] of Object.entries(over)) marks[Number(i)] = { ...marks[Number(i)], ...patch }
  return marks
}
