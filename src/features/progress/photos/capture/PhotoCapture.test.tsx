// E26-T7: take and align a progress photo (the spike's layers L0 file input, L1 align, L2 live).
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

/** The tests written for photos v2 run in Stand mode, which keeps all of its behaviour. */
function standEverywhere(): void {
  for (const view of ['front', 'side', 'back']) localStorage.setItem(`photoMode.${view}`, 'stand')
}

beforeEach(() => {
  localStorage.clear()
  standEverywhere()
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
    // Capture opens straight onto the camera view; the choices and the setup tips sit on it.
    expect(screen.getByRole('heading', { name: 'Front' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Front' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Side' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Back' })).toBeVisible()
    expect(screen.getByText(/chest height/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Use camera app' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose from library' })).toBeVisible()
  })

  test('O1 when the live camera fails, Take photo opens the camera file input in the same tap and says why', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click')
    setup()
    // The camera view says why, and Use camera app opens the iPhone camera in that tap.
    expect(await screen.findByText(/Camera preview unavailable/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Shutter' })).toBeDisabled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Use camera app' }))
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
    expect(screen.getByRole('heading', { name: 'Front' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Shutter' })).toBeVisible()
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
    await screen.findByRole('button', { name: 'Shutter' })
    await waitFor(() => expect(live.attach).toHaveBeenCalled())
    // No setup screen behind the camera view: Close ends the capture.
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(live.stop).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
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
    const flip = await screen.findByRole('button', { name: 'Switch to back camera' })
    expect(flip).toHaveTextContent('Back camera')
    expect((screen.getByLabelText('Camera photo') as HTMLInputElement).getAttribute('capture')).toBe('user')
    await user.click(flip)
    expect(await screen.findByRole('button', { name: 'Switch to front camera' })).toBeVisible()
    expect((screen.getByLabelText('Camera photo') as HTMLInputElement).getAttribute('capture')).toBe('environment')
  })

  test('the choice is remembered per view', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Switch to back camera' }))
    await user.click(screen.getByRole('radio', { name: 'Side' }))
    expect(await screen.findByRole('button', { name: 'Switch to back camera' })).toBeVisible()
    await user.click(screen.getByRole('radio', { name: 'Front' }))
    expect(await screen.findByRole('button', { name: 'Switch to front camera' })).toBeVisible()
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
    expect(await screen.findByText('Matching 10 Nov')).toBeVisible()
    await user.click(await screen.findByRole('button', { name: 'Switch to back camera' }))
    expect(await screen.findByText('Matching 12 Nov')).toBeVisible()
  })

  test('a failed switch reopens the camera that worked', async () => {
    const front = feedFor('user')
    const openCamera = vi.fn(async (facing?: 'user' | 'environment') => {
      if (facing === 'environment') throw new Error('no back camera')
      return front
    })
    setup({ openCamera })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Switch to back camera' }))
    await waitFor(() => expect(openCamera).toHaveBeenCalledTimes(3))
    expect(await screen.findByRole('button', { name: 'Switch to back camera' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Shutter' })).toBeEnabled()
  })

  test('the native camera path saves the camera and the path with the photo', async () => {
    const { onSave } = setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Switch to back camera' }))
    fireEvent.change(screen.getByLabelText('Camera photo'), { target: { files: [FILE] } })
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        file: FILE,
        day: DAY,
        angle: 'front',
        align: IDENTITY,
        camera: 'environment',
        source: 'native',
        mode: 'stand',
      }),
    )
  })
})

describe('photos v2 what the shutter stores', () => {
  test('a live frame saves its camera, path, stream size and the median angles at the shutter', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { onSave } = setup({ openCamera: async (f) => feedFor(f ?? 'user') })
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
    let open: (feed: LiveFeed) => void = () => undefined
    const opening = new Promise<LiveFeed>((resolve) => {
      open = resolve
    })
    setup({ photos: [withScale(photo('front', '2026-11-10'))], openCamera: () => opening, loadPose: load })
    await screen.findByRole('button', { name: 'Shutter' })
    expect(load).not.toHaveBeenCalled()
    await act(async () => open(feedFor('user')))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
  })

  test('bigger in the frame than the reference says Step back with the percent, then Matched once in the zone', async () => {
    let size = 1.1
    const pose = fakePose(() => size)
    setup({ photos: [withScale(photo('front', '2026-11-10'))], openCamera: async () => feedFor('user'), loadPose: pose.load })
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
    await screen.findByRole('button', { name: 'Shutter' })
    videoHasFrames()
    expect(await screen.findByText('Step back', {}, { timeout: 3000 })).toBeVisible()
    expect(image).toHaveBeenCalledTimes(1)
    Reflect.deleteProperty(globalThis, 'createImageBitmap')
  })

  test('without the model, the reference head and feet lines are drawn instead', async () => {
    const ref: Photo = { ...photo('front', '2026-11-10'), bodyLines: { head: 0.1, feet: 0.9 } }
    setup({ photos: [ref], openCamera: async () => feedFor('user') })
    expect(await screen.findByRole('img', { name: 'Head and feet lines from the last photo' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Distance' })).toBeNull()
  })

  test('the shutter stores the body scale and lines measured live', async () => {
    const pose = fakePose(() => 1)
    const { onSave } = setup({ openCamera: async () => feedFor('user'), loadPose: pose.load })
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
    await user.click(await screen.findByRole('button', { name: 'Switch to back camera' }))
    await screen.findByRole('button', { name: 'Switch to front camera' })
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

// --- mirror mode: the camera view holds every choice; Mirror and Stand ------------------------

/** A mirror reference matching body(1) at pitch 0 (h = -1.5) unless told otherwise. */
const mirrorRef = (over: Partial<Photo> = {}): Photo => ({
  ...photo('front', '2026-11-10'),
  id: 'mirror-ref',
  camera: 'environment',
  mode: 'mirror',
  bodyScale: { full: 0.6, torso: 0.2 },
  phoneHeight: -1.5,
  ...over,
})

/** body(1) with the shoulders and hips moved down by `dy` (the phone held higher). */
const lowered = (dy: number, over: Parameters<typeof body>[1] = {}) =>
  body(1, {
    11: { y: 0.2 + dy },
    12: { y: 0.2 + dy },
    23: { y: 0.4 + dy },
    24: { y: 0.4 + dy },
    27: { y: 0.8 + dy },
    28: { y: 0.8 + dy },
    ...over,
  })

function poseOf(marks: () => ReturnType<typeof body> | null): () => Promise<PoseModel> {
  const model: PoseModel = { video: () => marks(), image: async () => body(1), close: () => undefined }
  return async () => model
}

async function liveMirror(over: Partial<Parameters<typeof PhotoCapture>[0]> = {}) {
  const opened: string[] = []
  const live = feedFor('environment')
  const result = setup({
    openCamera: async (f) => {
      opened.push(f ?? 'user')
      return live
    },
    ...over,
  })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Shutter' })).toBeEnabled())
  videoHasFrames()
  return { ...result, live, opened }
}

describe('mirror mode: choices on the camera view', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('capture opens on the camera, Front and Mirror the first time, with the back camera', async () => {
    const { opened } = await liveMirror()
    expect(opened).toEqual(['environment'])
    expect(screen.getByRole('heading', { name: 'Front, mirror' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Front' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Mirror' })).toBeChecked()
    expect(document.querySelector('video')?.getAttribute('data-mirrored')).toBe('false')
  })

  test('Mirror has no timer and no camera switch; Auto is on and Sounds off', async () => {
    await liveMirror()
    expect(screen.queryByRole('radio', { name: '10s' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Auto on' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Sounds off' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('the mirror tips say face height and about 1.3 m, never 2.5 m', async () => {
    await liveMirror()
    const tips = screen.getByRole('region', { name: 'Setup' })
    expect(tips).toHaveTextContent(/phone in your right hand at face height/)
    expect(tips).toHaveTextContent(/about 1\.3 m from the mirror/)
    expect(document.body.textContent).not.toMatch(/2\.5 m/)
  })

  test('the mode is remembered per view; Back starts as Stand; the view last used opens next time', async () => {
    const { live } = await liveMirror()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Back' }))
    expect(screen.getByRole('radio', { name: 'Stand' })).toBeChecked()
    expect(await screen.findByRole('heading', { name: 'Back' })).toBeVisible()
    await user.click(screen.getByRole('radio', { name: 'Side' }))
    expect(screen.getByRole('radio', { name: 'Mirror' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Stand' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(live.stop).toHaveBeenCalled()
    cleanup()
    setup({ openCamera: async (f) => feedFor(f ?? 'user') })
    expect(screen.getByRole('radio', { name: 'Side' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Stand' })).toBeChecked()
  })

  test('Back in a mirror asks inline; Use Stand switches, Keep Mirror keeps it', async () => {
    await liveMirror()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Back' }))
    await user.click(screen.getByRole('radio', { name: 'Mirror' }))
    const note = screen.getByRole('group', { name: 'Back in a mirror' })
    expect(note).toHaveTextContent('A back photo needs the phone on a stand, or a second mirror. Use Stand?')
    await user.click(screen.getByRole('button', { name: 'Keep Mirror' }))
    expect(screen.queryByRole('group', { name: 'Back in a mirror' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Mirror' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Front' }))
    await user.click(screen.getByRole('radio', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Use Stand' }))
    expect(screen.getByRole('radio', { name: 'Stand' })).toBeChecked()
  })

  test('changing the mode reopens the camera in place: Stand keeps the view\'s own camera', async () => {
    const { opened } = await liveMirror()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Stand' }))
    await waitFor(() => expect(opened).toEqual(['environment', 'user']))
    expect(await screen.findByRole('button', { name: 'Switch to back camera' })).toBeVisible()
    expect(screen.getByRole('radio', { name: '10s' })).toBeVisible()
  })

  test('references are per view, mode and camera: a stand photo never guides a mirror one', async () => {
    const standPhoto: Photo = { ...photo('front', '2026-11-12'), camera: 'environment' }
    await liveMirror({ photos: [standPhoto] })
    expect(screen.queryByRole('img', { name: 'Last front photo' })).toBeNull()
    expect(screen.getByText('No mirror photo yet. This one becomes the reference.')).toBeVisible()
    cleanup()
    localStorage.clear()
    await liveMirror({ photos: [standPhoto, mirrorRef()] })
    expect(screen.getByRole('img', { name: 'Last front photo' })).toBeVisible()
    expect(screen.getByText('Matching 10 Nov')).toBeVisible()
  })

  test('the native camera fallback uses the back camera and stores the mirror mode', async () => {
    const { onSave } = setup()
    expect((screen.getByLabelText('Camera photo') as HTMLInputElement).getAttribute('capture')).toBe('environment')
    fireEvent.change(screen.getByLabelText('Camera photo'), { target: { files: [FILE] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        file: FILE,
        day: DAY,
        angle: 'front',
        align: IDENTITY,
        camera: 'environment',
        source: 'native',
        mode: 'mirror',
      }),
    )
  })
})

describe('mirror mode: the cues', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('a phone lower than last time says Raise the phone, then Matched once it is back', async () => {
    let marks = lowered(-0.1) // shoulders higher in the frame: the phone is lower
    await liveMirror({ photos: [mirrorRef()], loadPose: poseOf(() => marks) })
    expect(await screen.findByText('Raise the phone', {}, { timeout: 4000 })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Phone height' })).toBeInTheDocument()
    marks = lowered(0)
    expect(await screen.findByText('Matched', {}, { timeout: 4000 })).toBeVisible()
  })

  test('a phone higher than last time says Lower the phone', async () => {
    await liveMirror({ photos: [mirrorRef()], loadPose: poseOf(() => lowered(0.1)) })
    expect(await screen.findByText('Lower the phone', {}, { timeout: 4000 })).toBeVisible()
  })

  test('hidden ankles say Step back until your feet show; distance words name the mirror', async () => {
    let marks = body(1, { 27: { visibility: 0.1 }, 28: { visibility: 0.1 } })
    await liveMirror({ photos: [mirrorRef()], loadPose: poseOf(() => marks) })
    expect(await screen.findByText('Step back until your feet show', {}, { timeout: 4000 })).toBeVisible()
    marks = body(1.1)
    expect(await screen.findByText('Step back from the mirror', {}, { timeout: 4000 })).toBeVisible()
  })

  test('the other hand from last time shows a hint, without blocking Matched', async () => {
    const raisedRight = body(1, { 16: { x: 0.62, y: 0.1 } })
    await liveMirror({ photos: [mirrorRef({ phoneHand: 'left' })], loadPose: poseOf(() => raisedRight) })
    fireEvent.click(screen.getByRole('button', { name: 'Auto on' }))
    expect(await screen.findByText('Phone in your left hand, like last time', {}, { timeout: 4000 })).toBeVisible()
    expect(await screen.findByText('Matched', {}, { timeout: 4000 })).toBeVisible()
  })

  test('mirror mode is silent by default', async () => {
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
    await liveMirror({ photos: [mirrorRef()], loadPose: poseOf(() => body(size)) })
    fireEvent.click(screen.getByRole('button', { name: 'Auto on' }))
    expect(await screen.findByRole('group', { name: 'Distance' }, { timeout: 4000 })).toHaveTextContent('15% closer')
    size = 1
    expect(await screen.findByText('Matched', {}, { timeout: 4000 })).toBeVisible()
    expect(tones).toEqual([])
    Reflect.deleteProperty(globalThis, 'AudioContext')
  })
})

describe('mirror mode: the shutter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('all matched starts a visible 3 2 1, then takes the frame once and stores mode, height and hand', async () => {
    const raisedRight = body(1, { 16: { x: 0.62, y: 0.1 } })
    const { live, onSave } = await liveMirror({ photos: [mirrorRef()], loadPose: poseOf(() => raisedRight) })
    expect(await screen.findByText('Hold still · 3', {}, { timeout: 5000 })).toBeVisible()
    expect(live.grab).not.toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: 'Line up' }, { timeout: 5000 })).toBeVisible()
    expect(live.grab).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = (onSave.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(saved).toMatchObject({ mode: 'mirror', camera: 'environment', source: 'live', phoneHand: 'right' })
    expect(saved.phoneHeight).toBeCloseTo(-1.5, 1)
  })

  test('a tap starts a 2 s countdown instead of shooting at once; a second tap cancels it', async () => {
    const { live } = await liveMirror()
    fireEvent.click(screen.getByRole('button', { name: 'Auto on' }))
    fireEvent.click(screen.getByRole('button', { name: 'Shutter' }))
    expect(await screen.findByText('Hold still · 2')).toBeVisible()
    expect(live.grab).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Shutter' }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2400))
    })
    expect(live.grab).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Shutter' }))
    await waitFor(() => expect(live.grab).toHaveBeenCalledTimes(1), { timeout: 3000 })
  })

  test('with Auto off, matched never shoots by itself', async () => {
    const { live } = await liveMirror({ photos: [mirrorRef()], loadPose: poseOf(() => body(1)) })
    fireEvent.click(screen.getByRole('button', { name: 'Auto on' }))
    expect(await screen.findByText('Matched', {}, { timeout: 4000 })).toBeVisible()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2500))
    })
    expect(live.grab).not.toHaveBeenCalled()
  })
})
