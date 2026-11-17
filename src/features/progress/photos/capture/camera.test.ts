// photos v2: opening the front or the back camera.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { STREAM_CONSTRAINTS, openDeviceCamera, pickBackCamera } from './camera'
import { saveDeviceId, savedDeviceId } from './cameraPrefs'

type FakeTrack = { stop: ReturnType<typeof vi.fn>; readyState: string; muted: boolean; getSettings: () => MediaTrackSettings }

function stream(settings: MediaTrackSettings): MediaStream & { track: FakeTrack } {
  const track: FakeTrack = { stop: vi.fn(), readyState: 'live', muted: false, getSettings: () => settings }
  return { track, getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream & { track: FakeTrack }
}

function stubDevices(opts: {
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>
  devices?: Pick<MediaDeviceInfo, 'kind' | 'label' | 'deviceId'>[]
}) {
  const getUserMedia = vi.fn(opts.getUserMedia)
  const enumerateDevices = vi.fn(async () => opts.devices ?? [])
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia, enumerateDevices }, configurable: true })
  return { getUserMedia, enumerateDevices }
}

beforeEach(() => {
  localStorage.clear()
  // jsdom plays no media: play resolves and the first frame arrives at once.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    queueMicrotask(() => this.dispatchEvent(new Event('loadeddata')))
    return Promise.resolve()
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'mediaDevices')
})

const BACK_DEVICES = [
  { kind: 'videoinput' as const, label: 'Front Camera', deviceId: 'front-1' },
  { kind: 'videoinput' as const, label: 'Back Triple Camera', deviceId: 'triple' },
  { kind: 'videoinput' as const, label: 'Back Ultra Wide Camera', deviceId: 'ultra' },
  { kind: 'videoinput' as const, label: 'Back Camera', deviceId: 'wide' },
  { kind: 'audioinput' as const, label: 'Back Mic', deviceId: 'mic' },
]

describe('pickBackCamera', () => {
  test('prefers the plain wide back lens over triple, dual, ultra wide and telephoto', () => {
    expect(pickBackCamera(BACK_DEVICES)).toBe('wide')
    expect(pickBackCamera([{ kind: 'videoinput', label: 'Back Dual Wide Camera', deviceId: 'd' }])).toBeNull()
    expect(pickBackCamera([{ kind: 'videoinput', label: 'Back Telephoto Camera', deviceId: 't' }])).toBeNull()
  })

  test('labels hidden before a grant, or localised, find nothing', () => {
    expect(pickBackCamera([{ kind: 'videoinput', label: '', deviceId: 'x' }])).toBeNull()
    expect(pickBackCamera([{ kind: 'videoinput', label: 'Caméra arrière', deviceId: 'x' }])).toBeNull()
  })
})

describe('openDeviceCamera', () => {
  test('asks for 3:4 as ideal (never exact) and the facing as ideal', async () => {
    const { getUserMedia } = stubDevices({ getUserMedia: async () => stream({ facingMode: 'user', deviceId: 'f', width: 1440, height: 1920 }) })
    const feed = await openDeviceCamera('user')
    const video = (getUserMedia.mock.calls[0][0] as MediaStreamConstraints).video as MediaTrackConstraints
    expect(video).toMatchObject({ ...STREAM_CONSTRAINTS, facingMode: { ideal: 'user' } })
    expect(JSON.stringify(video)).not.toContain('exact')
    expect(feed.facing).toBe('user')
    expect(feed.facingMatches).toBe(true)
    expect(feed.size).toEqual({ width: 1440, height: 1920 })
    expect(savedDeviceId('user')).toBe('f')
  })

  test('the back camera: on the first grant it reopens on the plain wide lens and remembers it', async () => {
    const first = stream({ facingMode: 'environment', deviceId: 'triple' })
    const second = stream({ facingMode: 'environment', deviceId: 'wide' })
    const { getUserMedia, enumerateDevices } = stubDevices({
      getUserMedia: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second),
      devices: BACK_DEVICES,
    })
    // Before the grant the labels are empty, so the first ask is by facing.
    enumerateDevices.mockResolvedValueOnce([{ kind: 'videoinput', label: '', deviceId: 'triple' }])
    const feed = await openDeviceCamera('environment')
    expect((getUserMedia.mock.calls[0][0] as { video: MediaTrackConstraints }).video.facingMode).toEqual({ ideal: 'environment' })
    expect(first.track.stop).toHaveBeenCalled()
    expect((getUserMedia.mock.calls[1][0] as { video: MediaTrackConstraints }).video.deviceId).toEqual({ exact: 'wide' })
    expect(savedDeviceId('environment')).toBe('wide')
    expect(feed.facingMatches).toBe(true)
  })

  test('a remembered deviceId is asked for exactly; when it is gone, it is forgotten and facing is used', async () => {
    saveDeviceId('environment', 'old')
    const { getUserMedia } = stubDevices({
      getUserMedia: vi
        .fn()
        .mockRejectedValueOnce(new Error('OverconstrainedError'))
        .mockResolvedValueOnce(stream({ facingMode: 'environment', deviceId: 'new' })),
    })
    await openDeviceCamera('environment')
    expect((getUserMedia.mock.calls[0][0] as { video: MediaTrackConstraints }).video.deviceId).toEqual({ exact: 'old' })
    expect((getUserMedia.mock.calls[1][0] as { video: MediaTrackConstraints }).video.facingMode).toEqual({ ideal: 'environment' })
    expect(savedDeviceId('environment')).toBe('new')
  })

  test('a different camera than asked is flagged and not remembered', async () => {
    stubDevices({ getUserMedia: async () => stream({ facingMode: 'user', deviceId: 'front-1' }) })
    const feed = await openDeviceCamera('environment')
    expect(feed.facingMatches).toBe(false)
    expect(savedDeviceId('environment')).toBeNull()
  })

  test('stop ends every track and detaches the stream from every video it was shown in', async () => {
    const s = stream({ facingMode: 'user' })
    stubDevices({ getUserMedia: async () => s })
    const feed = await openDeviceCamera('user')
    const video = document.createElement('video')
    feed.attach(video)
    expect(video.srcObject).toBe(s)
    feed.stop()
    expect(s.track.stop).toHaveBeenCalled()
    expect(video.srcObject).toBeNull()
  })

  test('an ended track is refused and stopped', async () => {
    const s = stream({})
    s.track.readyState = 'ended'
    stubDevices({ getUserMedia: async () => s })
    await expect(openDeviceCamera('user')).rejects.toThrow('not live')
    expect(s.track.stop).toHaveBeenCalled()
  })

  test('no camera API rejects', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    await expect(openDeviceCamera('user')).rejects.toThrow('no camera API')
  })
})
