import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { SessionSummary } from './SessionSummary'
import { shareCardImage } from './ShareCard'
import type { Exercise, LibraryExercise, Session } from '../types'

// E26-T4 [O12]: the summary's Share sheet keeps "Share as text" and gains an image option.

vi.mock('./ShareCard', () => ({
  shareCardImage: vi.fn(() => Promise.resolve('shared')),
  renderShareCardBlob: vi.fn(() => Promise.resolve(new Blob())),
}))

const START = new Date(2026, 9, 12, 10).getTime()
const SESSION: Session = {
  id: 's1',
  programId: 'p',
  workoutId: 'w',
  startedAt: START,
  finishedAt: START + 45 * 60_000,
  entries: [{ exerciseId: 'bench', setIndex: 0, weightKg: 60, reps: 5, loggedAt: START }],
}
const BENCH: Exercise = { id: 'bench', name: 'Bench press', weightStep: 2.5, startWeight: 20, bodyweight: false, libraryId: 'Lib_x' }
const resolve = (id: string): Exercise | undefined => (id === 'bench' ? BENCH : undefined)

beforeEach(() => {
  localStorage.clear()
  vi.mocked(shareCardImage).mockClear()
  Reflect.deleteProperty(navigator, 'share')
})

function open(): void {
  render(
    <SessionSummary
      session={SESSION}
      resolve={resolve}
      library={new Map<string, LibraryExercise>()}
      workoutName="Push day"
      onClose={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Share' }))
}

test('O12 the Share sheet offers an image option next to Share as text', () => {
  open()
  expect(screen.getByRole('button', { name: 'Share as text' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Share as image' })).toBeTruthy()
})

test('O12 Share as image sends the workout card to the image share', async () => {
  open()
  fireEvent.click(screen.getByRole('button', { name: 'Share as image' }))
  await waitFor(() => expect(shareCardImage).toHaveBeenCalledTimes(1))
  const card = vi.mocked(shareCardImage).mock.calls[0][0]
  expect(card.name).toBe('Push day')
  expect(card.dateText).toBe('Mon 12 Oct')
  expect(card.durationText).toBe('45 min')
  expect(card.lifts).toEqual([{ name: 'Bench press', topSet: '60 kg × 5' }])
})

test('O12 Share as text still shares text only, no image', async () => {
  const share = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  open()
  expect(screen.getByRole('button', { name: 'Share as image' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Share as text' }))
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  const arg = (share.mock.calls[0] as unknown as [{ text: string; files?: unknown }])[0]
  expect(arg.text).toContain('Push day')
  expect(arg.files).toBeUndefined()
  expect(shareCardImage).not.toHaveBeenCalled()
})
