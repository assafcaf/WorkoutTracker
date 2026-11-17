// E26-T7: take and align a progress photo (the spike's layers L0 file input, L1 align, L2 live).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Photo } from '../../../../storage/photoStore'
import type { LiveFeed } from './camera'
import { PhotoCapture } from './PhotoCapture'

const DAY = '2026-11-17'
const FILE = new File(['pixels'], 'me.jpg', { type: 'image/jpeg' })
const IDENTITY = { scale: 1, rotate: 0, dx: 0, dy: 0 }

const photo = (angle: Photo['angle'], day: string): Photo => ({
  id: `${angle}-${day}`,
  day,
  angle,
  data: new Uint8Array([1, 2, 3]).buffer,
  type: 'image/jpeg',
  width: 800,
  height: 1200,
  align: null,
  createdAt: 1,
})

function feed(): LiveFeed & { grab: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> } {
  return {
    attach: vi.fn(),
    grab: vi.fn(async () => new Blob(['frame'], { type: 'image/jpeg' })),
    stop: vi.fn(),
  }
}

/** jsdom has no PointerEvent: a mouse event carrying the pointer id stands in for it. */
function pointer(target: Element, type: string, x: number): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 10 })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  fireEvent(target, event)
}

function setup(over: Partial<Parameters<typeof PhotoCapture>[0]> = {}) {
  const onSave = vi.fn(async () => undefined)
  const onClose = vi.fn()
  render(
    <PhotoCapture
      photos={[]}
      day={DAY}
      onSave={onSave}
      onClose={onClose}
      openCamera={() => Promise.reject(new Error('no camera'))}
      {...over}
    />,
  )
  return { onSave, onClose }
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('E26-T7 O1 the file-input path always works', () => {
  test('O1 the setup guidance, the three views and both ways to add a photo are offered', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'New photo' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Front' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Side' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Back' })).toBeVisible()
    expect(screen.getByText(/chest height/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose from library' })).toBeVisible()
  })

  test('O1 when the live camera fails, Take photo opens the camera file input in the same tap and says why', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click')
    setup()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Take photo' }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    const camera = screen.getByLabelText('Camera photo') as HTMLInputElement
    expect(camera.type).toBe('file')
    expect(camera.getAttribute('capture')).toBe('user')
    expect(screen.getByText(/Camera preview unavailable/)).toBeVisible()
  })

  test('O1 the library input takes an image without forcing the camera', () => {
    setup()
    const library = screen.getByLabelText('Library photo') as HTMLInputElement
    expect(library.type).toBe('file')
    expect(library.accept).toBe('image/*')
    expect(library.hasAttribute('capture')).toBe(false)
  })

  test('O1 a chosen photo opens the align screen; Save stores it with its day, view and alignment', async () => {
    const { onSave } = setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Side' }))
    fireEvent.change(screen.getByLabelText('Library photo'), { target: { files: [FILE] } })
    expect(await screen.findByRole('heading', { name: 'Line up' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ file: FILE, day: DAY, angle: 'side', align: IDENTITY }))
  })

  test('O1 Retake returns to the capture screen without saving', async () => {
    const { onSave } = setup()
    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Library photo'), { target: { files: [FILE] } })
    await user.click(await screen.findByRole('button', { name: 'Retake' }))
    expect(screen.getByRole('heading', { name: 'New photo' })).toBeVisible()
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('E26-T7 O2 aligning over the last photo', () => {
  test('O2 the last photo of the chosen view is the ghost; another view has none', async () => {
    setup({ photos: [photo('front', '2026-11-10'), photo('front', '2026-10-01')] })
    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Library photo'), { target: { files: [FILE] } })
    expect(await screen.findByRole('img', { name: 'Last front photo' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Retake' }))
    await user.click(screen.getByRole('radio', { name: 'Back' }))
    fireEvent.change(screen.getByLabelText('Library photo'), { target: { files: [FILE] } })
    await screen.findByRole('heading', { name: 'Line up' })
    expect(screen.queryByRole('img', { name: /Last .* photo/ })).toBeNull()
  })

  test('O2 dragging moves the new photo, Save keeps the move, Reset puts it back', async () => {
    const { onSave } = setup()
    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Library photo'), { target: { files: [FILE] } })
    const stage = await screen.findByRole('group', { name: 'Alignment' })
    pointer(stage, 'pointerdown', 10)
    pointer(stage, 'pointermove', 40)
    pointer(stage, 'pointerup', 40)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = (onSave.mock.calls[0] as unknown as [{ align: typeof IDENTITY }])[0].align
    expect(saved.dx).toBeGreaterThan(0)
    expect(saved.dy).toBe(0)

    onSave.mockClear()
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect((onSave.mock.calls[0] as unknown as [{ align: unknown }])[0].align).toEqual(IDENTITY)
  })
})

describe('E26-T7 O3 the live camera, when it works', () => {
  test('O3 Take photo shows the live view with the last photo as a 35 % ghost; the shutter takes the frame', async () => {
    const live = feed()
    setup({ photos: [photo('front', '2026-11-10')], openCamera: async () => live })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Take photo' }))
    expect(await screen.findByRole('button', { name: 'Ghost 35%' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Last front photo' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Shutter' }))
    expect(await screen.findByRole('heading', { name: 'Line up' })).toBeVisible()
    expect(live.grab).toHaveBeenCalledTimes(1)
    expect(live.stop).toHaveBeenCalled()
  })

  test('O3 the 10 s timer counts down and takes the frame at zero', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const live = feed()
    setup({ openCamera: async () => live })
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    fireEvent.click(screen.getByRole('radio', { name: '10 s' }))
    fireEvent.click(screen.getByRole('button', { name: 'Shutter' }))
    expect(await screen.findByText('10')).toBeVisible()
    expect(live.grab).not.toHaveBeenCalled()
    for (let second = 0; second < 10; second += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
    }
    expect(live.grab).toHaveBeenCalledTimes(1)
  })

  test('O3 the level reads the phone tilt from its gravity, and says Level within 1.5 degrees', async () => {
    setup({ openCamera: async () => feed() })
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    const motion = (x: number, y: number): void => {
      const event = new Event('devicemotion') as Event & { accelerationIncludingGravity: unknown }
      event.accelerationIncludingGravity = { x, y, z: 0 }
      act(() => {
        window.dispatchEvent(event)
      })
    }
    motion(0.85, -9.76)
    expect(await screen.findByText('Tilt 5°')).toBeVisible()
    motion(0, -9.8)
    expect(await screen.findByText('Level')).toBeVisible()
  })

  test('O3 Close leaves the live view and stops the camera', async () => {
    const live = feed()
    const { onClose } = setup({ openCamera: async () => live })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Take photo' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    expect(live.stop).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'New photo' })).toBeVisible()
  })
})
