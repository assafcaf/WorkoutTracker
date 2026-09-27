import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadCatalog } from '../../data/catalog'
import { loadLibrary, loadVideos } from '../../data/library'
import type { Exercise, LibraryExercise, Video } from '../../types'
import { DetailOverlay, type DetailOverlayProps } from './DetailOverlay'

// D7: the overlay renders what App.tsx's detail branch renders today -- ExerciseDetail for the
// library entry `libraryId` names, its video, photos resolved against the catalog, and a swap
// only when opened from a live set. The real bundled data backs the photo and video cases:
// back-squat's library entry is Barbell_Squat (src/data/exercises.json), whose video is
// youtube R2dMsNhN3DE (src/data/library/videos.json); Wide_Stance_Barbell_Squat is in no
// catalog entry, so its photos come from the pinned free-exercise-db copy.

async function realData(): Promise<{
  catalog: Map<string, Exercise>
  library: LibraryExercise[]
  videos: Map<string, Video>
}> {
  return { catalog: loadCatalog(), library: [...(await loadLibrary()).values()], videos: await loadVideos() }
}

function curl(id: string, name: string, secondaryMuscles: LibraryExercise['secondaryMuscles']): LibraryExercise {
  return {
    id,
    name,
    force: 'pull',
    level: 'beginner',
    mechanic: 'isolation',
    equipment: null,
    primaryMuscles: ['biceps'],
    secondaryMuscles,
    instructions: [],
    category: 'strength',
    images: [],
  }
}

// A hand-built library: Alpha Curl shares both of Target Curl's secondary muscles, so it ranks
// first among its "Similar exercises".
const TARGET_CURL = curl('Target_Curl', 'Target Curl', ['forearms', 'shoulders'])
const ALPHA_CURL = curl('Alpha_Curl', 'Alpha Curl', ['forearms', 'shoulders'])
const CURLS: LibraryExercise[] = [TARGET_CURL, ALPHA_CURL]

function curlProps(over: Partial<DetailOverlayProps> = {}): DetailOverlayProps {
  return {
    libraryId: 'Target_Curl',
    catalog: new Map(),
    library: CURLS,
    videos: new Map(),
    gymEquipment: null,
    onBack: vi.fn(),
    onOpenDetail: vi.fn(),
    ...over,
  }
}

/** The "Similar exercises" row whose open control is named `name`. */
function similarRow(name: string): HTMLElement {
  const control =
    screen.queryByRole('link', { name, exact: true }) ?? screen.getByRole('button', { name, exact: true })
  const row = control.closest('li')
  if (!row) throw new Error(`no row list item found for "${name}"`)
  return row
}

test("D7 DetailOverlay shows the library entry's own name when no heading is given", () => {
  render(<DetailOverlay {...curlProps()} />)

  expect(screen.getByRole('heading', { name: 'Target Curl' })).toBeVisible()
})

test('D7 DetailOverlay shows the heading it was opened with', async () => {
  const data = await realData()

  render(<DetailOverlay {...curlProps({ ...data, libraryId: 'Barbell_Squat', heading: 'Back squat' })} />)

  expect(screen.getByRole('heading', { name: 'Back squat' })).toBeVisible()
})

test("D7 DetailOverlay links the entry's video", async () => {
  const data = await realData()

  render(<DetailOverlay {...curlProps({ ...data, libraryId: 'Barbell_Squat' })} />)

  expect(screen.getByRole('link', { name: 'Watch video' })).toHaveAttribute(
    'href',
    'https://www.youtube.com/watch?v=R2dMsNhN3DE',
  )
})

test("D7 DetailOverlay shows a catalog exercise's bundled photos", async () => {
  const data = await realData()

  render(<DetailOverlay {...curlProps({ ...data, libraryId: 'Barbell_Squat' })} />)

  expect(screen.getByRole('img', { name: 'Barbell Squat photo 1' })).toHaveAttribute(
    'src',
    '/library-photos/Barbell_Squat/0.jpg',
  )
})

test("D7 DetailOverlay shows a non-catalog exercise's photos from free-exercise-db", async () => {
  const data = await realData()

  render(<DetailOverlay {...curlProps({ ...data, libraryId: 'Wide_Stance_Barbell_Squat' })} />)

  const src = screen.getAllByRole('img', { name: /photo 1$/ })[0].getAttribute('src') ?? ''
  expect(src.startsWith('https://raw.githubusercontent.com/yuhonas/free-exercise-db/')).toBe(true)
  expect(src.endsWith('/exercises/Wide_Stance_Barbell_Squat/0.jpg')).toBe(true)
})

test('D7 DetailOverlay Back calls onBack', async () => {
  const user = userEvent.setup()
  const onBack = vi.fn()

  render(<DetailOverlay {...curlProps({ onBack })} />)
  await user.click(screen.getByRole('button', { name: 'Back' }))

  expect(onBack).toHaveBeenCalledTimes(1)
})

test('D7 DetailOverlay opened from a live set swaps to a similar exercise through onSwap', async () => {
  const user = userEvent.setup()
  const onSwap = vi.fn()

  render(<DetailOverlay {...curlProps({ plannedId: 'seated-biceps-curls', onSwap })} />)
  await user.click(within(similarRow('Alpha Curl')).getByRole('button', { name: 'Do this instead' }))

  expect(onSwap).toHaveBeenCalledTimes(1)
  expect(onSwap).toHaveBeenCalledWith('Alpha_Curl')
})

test('D7 DetailOverlay opened without a plannedId offers no swap', () => {
  render(<DetailOverlay {...curlProps({ onSwap: vi.fn() })} />)

  expect(similarRow('Alpha Curl')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Do this instead' })).toBeNull()
})

test("D7 DetailOverlay opens a similar exercise's own detail through onOpenDetail", async () => {
  const user = userEvent.setup()
  const onOpenDetail = vi.fn()

  render(<DetailOverlay {...curlProps({ onOpenDetail })} />)
  const control =
    screen.queryByRole('link', { name: 'Alpha Curl', exact: true }) ??
    screen.getByRole('button', { name: 'Alpha Curl', exact: true })
  await user.click(control)

  expect(onOpenDetail).toHaveBeenCalledWith('Alpha_Curl')
})

test('D7 DetailOverlay renders nothing for a libraryId the library does not have', () => {
  const { container } = render(<DetailOverlay {...curlProps({ libraryId: 'No_Such_Exercise' })} />)

  expect(container).toBeEmptyDOMElement()
})
