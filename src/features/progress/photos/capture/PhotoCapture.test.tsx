// E26-T7: take and align a progress photo (the spike's layers L0 file input, L1 align, L2 live).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Photo } from '../../../../storage/photoStore'
import type { LiveFeed } from './camera'
import type { PoseModel } from './pose'
import { body } from './testPose'
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
      loadPose={() => Promise.reject(new Error('no model'))}
      {...over}
    />,
  )
  return { onSave, onClose }
}

beforeEach(() => {
  localStorage.clear()
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
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ file: FILE, day: DAY, angle: 'side', align: IDENTITY, source: 'library' }),
    )
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
    await user.click(await screen.findByRole('button', { name: 'Next: Side' }))
    fireEvent.change(screen.getByLabelText('Library photo'), { target: { files: [FILE] } })
    const again = await screen.findByRole('group', { name: 'Alignment' })
    pointer(again, 'pointerdown', 10)
    pointer(again, 'pointermove', 40)
    pointer(again, 'pointerup', 40)
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
    fireEvent.click(screen.getByRole('radio', { name: '10s' }))
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
    vi.useFakeTimers({ shouldAdvanceTime: true })
    setup({ openCamera: async () => feed() })
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    // Raw gravity only (no `acceleration`): the stronger filter and the 1.5 degree band.
    const holdFor = async (ms: number, x: number, y: number): Promise<void> => {
      for (let t = 0; t < ms; t += 16) {
        const event = new Event('devicemotion') as Event & { accelerationIncludingGravity: unknown }
        event.accelerationIncludingGravity = { x, y, z: 0 }
        window.dispatchEvent(event)
        await act(async () => {
          await vi.advanceTimersByTimeAsync(16)
        })
      }
    }
    await holdFor(300, 0.85, -9.76)
    expect(screen.getByText('Tilt right 5°')).toBeVisible()
    await holdFor(3000, 0, -9.8)
    expect(screen.getByText('Level')).toBeVisible()
  })

  test('photos v2: the level reads fused gravity, so a tap on the phone does not move it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    setup({ openCamera: async () => feed() })
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    // iOS reports a tap as user acceleration in both fields; gravity is their difference.
    const sample = (shake: number): void => {
      const event = new Event('devicemotion') as Event & { accelerationIncludingGravity: unknown; acceleration: unknown }
      event.accelerationIncludingGravity = { x: shake, y: -9.8, z: 0 }
      event.acceleration = { x: shake, y: 0, z: 0 }
      window.dispatchEvent(event)
    }
    for (let i = 0; i < 120; i += 1) {
      sample(0)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16)
      })
    }
    expect(screen.getByText('Level')).toBeVisible()
    sample(3) // a tap: about 17 degrees in the raw reading, none in gravity
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16)
    })
    for (let i = 0; i < 10; i += 1) {
      sample(0)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16)
      })
    }
    expect(screen.getByText('Level')).toBeVisible()
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

// --- photos v2: back camera, steady level, distance cue, check-in -----------------------------

function feedFor(facing: 'user' | 'environment') {
  return { ...feed(), facing, facingMatches: true, size: { width: 1440, height: 1920 } }
}

/** A pose model whose live frames show a body `size()` times the reference's. */
function fakePose(size: () => number | null): { model: PoseModel; load: () => Promise<PoseModel> } {
  const model: PoseModel = {
    video: () => {
      const s = size()
      return s === null ? null : body(s)
    },
    image: async () => body(1),
    close: () => undefined,
  }
  return { model, load: async () => model }
}

/** jsdom plays no video: give the live view's video a frame size. */
function videoHasFrames(): void {
  const video = document.querySelector('video') as HTMLVideoElement
  Object.defineProperty(video, 'videoWidth', { value: 600, configurable: true })
  Object.defineProperty(video, 'videoHeight', { value: 800, configurable: true })
}

const withScale = (p: Photo): Photo => ({ ...p, bodyScale: { full: 0.6, torso: 0.2 } })

describe('photos v2 back camera and switching', () => {
  test('the camera choice is offered, named, and the native camera input follows it', async () => {
    setup()
    const user = userEvent.setup()
    expect(screen.getByRole('radio', { name: 'Front camera' })).toBeChecked()
    expect((screen.getByLabelText('Camera photo') as HTMLInputElement).getAttribute('capture')).toBe('user')
    await user.click(screen.getByRole('radio', { name: 'Back camera' }))
    expect((screen.getByLabelText('Camera photo') as HTMLInputElement).getAttribute('capture')).toBe('environment')
  })

  test('the choice is remembered per view', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Back camera' }))
    await user.click(screen.getByRole('radio', { name: 'Side' }))
    expect(screen.getByRole('radio', { name: 'Front camera' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Front' }))
    expect(screen.getByRole('radio', { name: 'Back camera' })).toBeChecked()
  })

  test('switching stops the old tracks before asking for the other camera, and mirrors only the front', async () => {
    const order: string[] = []
    const front = feedFor('user')
    front.stop.mockImplementation(() => order.push('stop front'))
    const back = feedFor('environment')
    const openCamera = vi.fn(async (facing?: 'user' | 'environment') => {
      order.push(`open ${facing}`)
      return facing === 'environment' ? back : front
    })
    setup({ openCamera })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    expect(document.querySelector('video')?.getAttribute('data-mirrored')).toBe('true')
    const flip = screen.getByRole('button', { name: 'Switch to back camera' })
    expect(flip).toHaveTextContent('Back camera')
    await user.click(flip)
    expect(await screen.findByRole('button', { name: 'Switch to front camera' })).toBeVisible()
    expect(order.slice(0, 3)).toEqual(['open user', 'stop front', 'open environment'])
    expect(document.querySelector('video')?.getAttribute('data-mirrored')).toBe('false')
    expect(back.attach).toHaveBeenCalled()
  })

  test('each camera has its own reference: a front ghost never sits over the back preview', async () => {
    const backPhoto: Photo = { ...photo('front', '2026-11-12'), id: 'back-cam', camera: 'environment' }
    setup({ photos: [backPhoto, photo('front', '2026-11-10')], openCamera: async (f) => feedFor(f ?? 'user') })
    const user = userEvent.setup()
    expect(screen.getByText(/Your 10 Nov front photo/)).toBeVisible()
    await user.click(screen.getByRole('radio', { name: 'Back camera' }))
    expect(screen.getByText(/Your 12 Nov front photo/)).toBeVisible()
  })

  test('a failed switch reopens the camera that worked', async () => {
    const front = feedFor('user')
    const openCamera = vi.fn(async (facing?: 'user' | 'environment') => {
      if (facing === 'environment') throw new Error('no back camera')
      return front
    })
    setup({ openCamera })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Take photo' }))
    await user.click(await screen.findByRole('button', { name: 'Switch to back camera' }))
    await waitFor(() => expect(openCamera).toHaveBeenCalledTimes(3))
    expect(await screen.findByRole('button', { name: 'Switch to back camera' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Shutter' })).toBeEnabled()
  })

  test('the native camera path saves the camera and the path with the photo', async () => {
    const { onSave } = setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Back camera' }))
    fireEvent.change(screen.getByLabelText('Camera photo'), { target: { files: [FILE] } })
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ file: FILE, day: DAY, angle: 'front', align: IDENTITY, camera: 'environment', source: 'native' }),
    )
  })
})

describe('photos v2 what the shutter stores', () => {
  test('a live frame saves its camera, path, stream size and the median angles at the shutter', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { onSave } = setup({ openCamera: async (f) => feedFor(f ?? 'user') })
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    const g = { x: 9.80665 * Math.sin(Math.PI / 90), y: -9.80665 * Math.cos(Math.PI / 90), z: 0 }
    for (let t = 0; t < 1000; t += 16) {
      const event = new Event('devicemotion') as Event & { accelerationIncludingGravity: unknown; acceleration: unknown }
      event.accelerationIncludingGravity = g
      event.acceleration = { x: 0, y: 0, z: 0 }
      window.dispatchEvent(event)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16)
      })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Shutter' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = (onSave.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(saved).toMatchObject({ camera: 'user', source: 'live', streamWidth: 1440, streamHeight: 1920, pitch: 0 })
    expect(saved.roll).toBeCloseTo(2, 1)
  })
})

describe('photos v2 the distance cue', () => {
  test('the pose model loads only when the live camera opens', async () => {
    const load = vi.fn(fakePose(() => 1).load)
    setup({ photos: [withScale(photo('front', '2026-11-10'))], openCamera: async () => feedFor('user'), loadPose: load })
    expect(load).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
  })

  test('bigger in the frame than the reference says Step back with the percent, then Matched once in the zone', async () => {
    let size = 1.1
    const pose = fakePose(() => size)
    setup({ photos: [withScale(photo('front', '2026-11-10'))], openCamera: async () => feedFor('user'), loadPose: pose.load })
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    videoHasFrames()
    const distance = await screen.findByRole('group', { name: 'Distance' }, { timeout: 3000 })
    expect(distance).toHaveTextContent('10% closer')
    expect(screen.getByText('Step back')).toBeVisible()
    size = 0.99
    expect(await screen.findByText('Matched', {}, { timeout: 4000 })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Distance' })).toHaveTextContent('Same distance')
  })

  test('smaller in the frame says Come closer; a hidden body says Step into frame', async () => {
    let size: number | null = 0.85
    const pose = fakePose(() => size)
    setup({ photos: [withScale(photo('front', '2026-11-10'))], openCamera: async () => feedFor('user'), loadPose: pose.load })
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    videoHasFrames()
    expect(await screen.findByText('Come closer', {}, { timeout: 3000 })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Distance' })).toHaveTextContent('15% farther')
    size = null
    expect(await screen.findByText('Step into frame', {}, { timeout: 3000 })).toBeVisible()
  })

  test('a reference without a stored scale is measured once on its still', async () => {
    const pose = fakePose(() => 1.2)
    const image = vi.spyOn(pose.model, 'image')
    ;(globalThis as { createImageBitmap?: unknown }).createImageBitmap = vi.fn(async () => ({ width: 600, height: 800 }))
    setup({ photos: [photo('front', '2026-11-10')], openCamera: async () => feedFor('user'), loadPose: pose.load })
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    videoHasFrames()
    expect(await screen.findByText('Step back', {}, { timeout: 3000 })).toBeVisible()
    expect(image).toHaveBeenCalledTimes(1)
    Reflect.deleteProperty(globalThis, 'createImageBitmap')
  })

  test('without the model, the reference head and feet lines are drawn instead', async () => {
    const ref: Photo = { ...photo('front', '2026-11-10'), bodyLines: { head: 0.1, feet: 0.9 } }
    setup({ photos: [ref], openCamera: async () => feedFor('user') })
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    expect(await screen.findByRole('img', { name: 'Head and feet lines from the last photo' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Distance' })).toBeNull()
  })

  test('the shutter stores the body scale and lines measured live', async () => {
    const pose = fakePose(() => 1)
    const { onSave } = setup({ openCamera: async () => feedFor('user'), loadPose: pose.load })
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    videoHasFrames()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 700))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Shutter' }))
    expect(await screen.findByRole('slider', { name: 'Top of head' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = (onSave.mock.calls[0] as unknown as [{ bodyScale: { full: number; torso: number }; bodyLines: unknown }])[0]
    expect(saved.bodyScale.full).toBeCloseTo(0.6)
    expect(saved.bodyScale.torso).toBeCloseTo(0.2)
    expect(saved.bodyLines).toBeTruthy()
  })

  test('with the back camera, ticks sound while out of the zone and a tone when matched', async () => {
    const tones: number[] = []
    class FakeAudio {
      state = 'running'
      currentTime = 0
      destination = {}
      resume = async () => undefined
      createOscillator() {
        const o = { type: '', frequency: { value: 0 }, connect: () => undefined, start: () => tones.push(o.frequency.value), stop: () => undefined }
        return o
      }
      createGain() {
        return { gain: { value: 0 }, connect: () => undefined }
      }
    }
    ;(globalThis as { AudioContext?: unknown }).AudioContext = FakeAudio
    let size = 1.15
    const pose = fakePose(() => size)
    const backRef: Photo = { ...withScale(photo('front', '2026-11-10')), camera: 'environment' }
    setup({ photos: [backRef], openCamera: async (f) => feedFor(f ?? 'user'), loadPose: pose.load })
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Back camera' }))
    await user.click(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByRole('button', { name: 'Shutter' })
    videoHasFrames()
    await waitFor(() => expect(tones.filter((hz) => hz === 1200).length).toBeGreaterThan(0), { timeout: 3000 })
    size = 1
    await waitFor(() => expect(tones).toContain(1320), { timeout: 4000 })
    Reflect.deleteProperty(globalThis, 'AudioContext')
  })
})

describe('photos v2 a check-in in one go', () => {
  test('after a save it offers the next view, front then side then back, then Done closes', async () => {
    const { onSave, onClose } = setup()
    const user = userEvent.setup()
    const add = async (): Promise<void> => {
      fireEvent.change(screen.getByLabelText('Library photo'), { target: { files: [FILE] } })
      await user.click(await screen.findByRole('button', { name: 'Save' }))
    }
    await add()
    await user.click(await screen.findByRole('button', { name: 'Next: Side' }))
    expect(screen.getByRole('radio', { name: 'Side' })).toBeChecked()
    await add()
    await user.click(await screen.findByRole('button', { name: 'Next: Back' }))
    await add()
    expect(await screen.findByText(/Every view for today is done/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Next/ })).toBeNull()
    expect(onSave.mock.calls.map((c) => (c as unknown as [{ angle: string }])[0].angle)).toEqual(['front', 'side', 'back'])
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('views already taken that day are skipped', async () => {
    setup({ photos: [photo('side', DAY)] })
    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Library photo'), { target: { files: [FILE] } })
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('button', { name: 'Next: Back' })).toBeVisible()
  })

  test('Done after the first photo closes the flow', async () => {
    const { onClose } = setup()
    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Library photo'), { target: { files: [FILE] } })
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    await user.click(await screen.findByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
