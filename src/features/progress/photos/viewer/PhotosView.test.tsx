// Photos viewer: the Photos page (angle tabs, newest-first timeline, empty state) and its
// full-screen viewer (step between dates, timelapse, Compare, delete with Undo), over props.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import type { Photo, PhotoAngle } from '../../../../storage/photoStore'
import type { BodyLog } from '../../../../types'
import { PhotosView, type PhotosViewProps } from './PhotosView'

process.env.TZ = 'Asia/Jerusalem'

// jsdom has no PointerEvent, so fireEvent.pointer* would build a bare Event with no clientX
// (as in src/ui/scrubDial.test.tsx): a MouseEvent carries clientX, the shim adds the pointerId.
beforeAll(() => {
  if (typeof window.PointerEvent === 'function') return
  class PointerEventShim extends MouseEvent {
    readonly pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
    }
  }
  window.PointerEvent = PointerEventShim as unknown as typeof PointerEvent
})

const NOW = new Date(2026, 10, 17, 9, 0).getTime()

function photo(id: string, day: string, angle: PhotoAngle = 'front', align: Photo['align'] = null): Photo {
  return {
    id,
    day,
    angle,
    data: new Uint8Array([1, 2, 3]).buffer,
    type: 'image/jpeg',
    width: 30,
    height: 40,
    align,
    createdAt: 1,
  }
}

const PHOTOS: Photo[] = [
  photo('f0', '2026-09-30'),
  photo('f1', '2026-10-12', 'front', { scale: 1.1, rotate: 2, dx: 0.05, dy: -0.02 }),
  photo('f2', '2026-11-17'),
  photo('s0', '2026-10-12', 'side'),
]
const LOG: BodyLog = [
  { day: '2026-09-30', weightKg: 84.3 },
  { day: '2026-11-17', weightKg: 82.2 },
]

function mount(overrides: Partial<PhotosViewProps> = {}) {
  const props: PhotosViewProps = {
    photos: PHOTOS,
    log: LOG,
    now: NOW,
    onBack: () => undefined,
    onAdd: vi.fn(),
    onCompare: vi.fn(),
    onDelete: vi.fn(async () => undefined),
    onRestore: vi.fn(async () => undefined),
    reducedMotion: false,
    ...overrides,
  }
  const user = userEvent.setup()
  const view = render(<PhotosView {...props} />)
  return { user, props, view }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('photos page: angle tabs and the timeline', () => {
  test('opens on Front with every front photo newest first, named by date and that day’s bodyweight', () => {
    mount()
    expect(screen.getByRole('radio', { name: 'Front' })).toBeChecked()
    const tiles = within(screen.getByRole('region', { name: 'Front photos' })).getAllByRole('button')
    expect(tiles.map((t) => t.getAttribute('aria-label'))).toEqual([
      'Front photo, 17 Nov, 82.2 kg',
      'Front photo, 12 Oct',
      'Front photo, 30 Sep, 84.3 kg',
    ])
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeVisible()
    expect(screen.getByText('3 photos since 30 Sep · −2.1 kg')).toBeVisible()
  })

  test('the Side tab shows only side photos', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('radio', { name: 'Side' }))
    const tiles = within(screen.getByRole('region', { name: 'Side photos' })).getAllByRole('button')
    expect(tiles.map((t) => t.getAttribute('aria-label'))).toEqual(['Side photo, 12 Oct'])
  })

  test('an angle with no photos says so and offers to take one', async () => {
    const { user, props } = mount()
    await user.click(screen.getByRole('radio', { name: 'Back' }))
    expect(screen.getByText('No back photos yet.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Add photo' }))
    expect(props.onAdd).toHaveBeenCalled()
  })

  test('with no photos at all the page invites the first check-in', async () => {
    const { user, props } = mount({ photos: [] })
    expect(screen.getByRole('heading', { name: 'Your first check-in' })).toBeVisible()
    expect(screen.queryByRole('radiogroup', { name: 'Angle' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Take your first photos' }))
    expect(props.onAdd).toHaveBeenCalled()
  })

  test('thumbnails carry the saved alignment so they line up', () => {
    mount()
    const tile = screen.getByRole('button', { name: 'Front photo, 12 Oct' })
    expect(tile.querySelector('img')).toHaveStyle({ transform: 'translate(5%, -2%) rotate(2deg) scale(1.1)' })
  })
})

describe('photos viewer: full screen, one angle across dates', () => {
  test('a tile opens the viewer on that photo with its date, bodyweight and the change since the first', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Front photo, 17 Nov, 82.2 kg' }))
    const viewer = screen.getByRole('dialog', { name: 'Front photos' })
    expect(within(viewer).getByRole('heading', { name: '17 Nov' })).toBeVisible()
    expect(within(viewer).getByText('82.2 kg')).toBeVisible()
    expect(within(viewer).getByText('48 days since first · −2.1 kg')).toBeVisible()
    expect(within(viewer).getByText('3 of 3')).toBeVisible()
    expect(within(viewer).getByRole('img', { name: 'Front photo, 17 Nov' })).toBeVisible()
    expect(within(viewer).getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  test('the viewer applies the saved alignment transform', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Front photo, 12 Oct' }))
    expect(screen.getByRole('img', { name: 'Front photo, 12 Oct' })).toHaveStyle({
      transform: 'translate(5%, -2%) rotate(2deg) scale(1.1)',
    })
  })

  test('mirror mode: a mirror photo among stand ones is drawn flipped and marked Mirror', async () => {
    const mirrorPhoto: Photo = { ...photo('m1', '2026-11-17', 'front', { scale: 1.1, rotate: 2, dx: 0.05, dy: -0.02 }), mode: 'mirror' }
    const { user } = mount({ photos: [photo('f0', '2026-09-30'), mirrorPhoto] })
    await user.click(screen.getByRole('button', { name: /Front photo, 17 Nov/ }))
    const viewer = screen.getByRole('dialog', { name: 'Front photos' })
    expect(within(viewer).getByText('Mirror')).toBeVisible()
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Front photo, 17 Nov' })).toHaveStyle({
        transform: 'scaleX(-1) translate(5%, -2%) rotate(2deg) scale(1.1)',
      }),
    )
    await user.click(within(viewer).getByRole('button', { name: /Previous/ }))
    expect(screen.getByRole('img', { name: /^Front photo, 30 Sep/ }).style.transform).not.toContain('scaleX')
  })

  test('mirror mode: mirror photos among mirror photos are never flipped', async () => {
    const m = (id: string, day: string): Photo => ({ ...photo(id, day), mode: 'mirror' })
    const { user } = mount({ photos: [m('m0', '2026-09-30'), m('m1', '2026-11-17')] })
    await user.click(screen.getByRole('button', { name: /Front photo, 17 Nov/ }))
    expect(screen.getByRole('img', { name: 'Front photo, 17 Nov' }).style.transform).not.toContain('scaleX')
  })

  test('Previous and Next step between dates of the same angle, named by the date they go to', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Front photo, 12 Oct' }))
    await user.click(screen.getByRole('button', { name: 'Next photo, 17 Nov' }))
    expect(screen.getByRole('heading', { name: '17 Nov' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous photo, 12 Oct' }))
    await user.click(screen.getByRole('button', { name: 'Previous photo, 30 Sep' }))
    expect(screen.getByRole('heading', { name: '30 Sep' })).toBeVisible()
    expect(screen.getByText('First photo')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeDisabled()
  })

  test('the arrow keys step and Escape closes', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Front photo, 12 Oct' }))
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('heading', { name: '30 Sep' })).toBeVisible()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('heading', { name: '17 Nov' })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('region', { name: 'Front photos' })).toBeVisible()
  })

  test('a swipe left goes to the newer photo, a swipe right to the older', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Front photo, 12 Oct' }))
    const frame = screen.getByTestId('photo-viewer-frame')
    fireEvent.pointerDown(frame, { clientX: 200, pointerId: 1 })
    fireEvent.pointerUp(frame, { clientX: 100, pointerId: 1 })
    expect(screen.getByRole('heading', { name: '17 Nov' })).toBeVisible()
    fireEvent.pointerDown(frame, { clientX: 100, pointerId: 1 })
    fireEvent.pointerUp(frame, { clientX: 260, pointerId: 1 })
    expect(screen.getByRole('heading', { name: '12 Oct' })).toBeVisible()
    // A tap is not a swipe.
    fireEvent.pointerDown(frame, { clientX: 100, pointerId: 1 })
    fireEvent.pointerUp(frame, { clientX: 110, pointerId: 1 })
    expect(screen.getByRole('heading', { name: '12 Oct' })).toBeVisible()
  })

  test('Close returns to the timeline', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Front photo, 12 Oct' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('photos viewer: the timelapse', () => {
  test('Play steps through every date from the first to the last, then stops', () => {
    vi.useFakeTimers()
    mount({ playMs: 500 })
    fireEvent.click(screen.getByRole('button', { name: 'Front photo, 17 Nov, 82.2 kg' }))
    // At the last photo, Play starts again from the first.
    fireEvent.click(screen.getByRole('button', { name: 'Play timelapse' }))
    expect(screen.getByRole('heading', { name: '30 Sep' })).toBeVisible()
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByRole('heading', { name: '12 Oct' })).toBeVisible()
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByRole('heading', { name: '17 Nov' })).toBeVisible()
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByRole('button', { name: 'Play timelapse' })).toBeVisible()
  })

  test('Pause holds the photo on screen', () => {
    vi.useFakeTimers()
    mount({ playMs: 500 })
    fireEvent.click(screen.getByRole('button', { name: 'Front photo, 30 Sep, 84.3 kg' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play timelapse' }))
    act(() => vi.advanceTimersByTime(500))
    fireEvent.click(screen.getByRole('button', { name: 'Pause timelapse' }))
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('heading', { name: '12 Oct' })).toBeVisible()
  })

  test('with reduced motion the photos change without the fade', async () => {
    const { user, view } = mount({ reducedMotion: true })
    await user.click(screen.getByRole('button', { name: 'Front photo, 12 Oct' }))
    expect(screen.getByRole('dialog')).toHaveClass('photo-viewer--still')
    view.unmount()
    const again = mount({ reducedMotion: false })
    await again.user.click(screen.getByRole('button', { name: 'Front photo, 12 Oct' }))
    expect(screen.getByRole('dialog')).not.toHaveClass('photo-viewer--still')
  })
})

describe('photos viewer: Compare and delete', () => {
  test('Compare opens the Compare page on the first photo and this one', async () => {
    const { user, props } = mount()
    await user.click(screen.getByRole('button', { name: 'Front photo, 12 Oct' }))
    await user.click(screen.getByRole('button', { name: 'Compare 30 Sep with 12 Oct' }))
    expect(props.onCompare).toHaveBeenCalledWith({ angle: 'front', before: 'f0', after: 'f1' })
  })

  test('on the first photo Compare pairs it with the latest', async () => {
    const { user, props } = mount()
    await user.click(screen.getByRole('button', { name: 'Front photo, 30 Sep, 84.3 kg' }))
    await user.click(screen.getByRole('button', { name: 'Compare 30 Sep with 17 Nov' }))
    expect(props.onCompare).toHaveBeenCalledWith({ angle: 'front', before: 'f0', after: 'f2' })
  })

  test('Delete removes the photo, moves to its neighbour and offers Undo, which puts it back', async () => {
    const { user, props, view } = mount()
    await user.click(screen.getByRole('button', { name: 'Front photo, 12 Oct' }))
    await user.click(screen.getByRole('button', { name: 'Delete photo, 12 Oct' }))
    expect(props.onDelete).toHaveBeenCalledWith(PHOTOS[1])
    // The service re-reads the list without it.
    view.rerender(<PhotosView {...props} photos={PHOTOS.filter((p) => p.id !== 'f1')} />)
    expect(screen.getByRole('heading', { name: '17 Nov' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Photo deleted · 12 Oct')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(props.onRestore).toHaveBeenCalledWith(PHOTOS[1])
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  test('deleting the only photo of an angle closes the viewer and keeps Undo', async () => {
    const { user, props, view } = mount()
    await user.click(screen.getByRole('radio', { name: 'Side' }))
    await user.click(screen.getByRole('button', { name: 'Side photo, 12 Oct' }))
    await user.click(screen.getByRole('button', { name: 'Delete photo, 12 Oct' }))
    view.rerender(<PhotosView {...props} photos={PHOTOS.filter((p) => p.id !== 's0')} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('No side photos yet.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible()
  })
})
