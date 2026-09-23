import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ExerciseDetail } from './ExerciseDetail'
import type { LibraryExercise, Video } from '../types'

// Barbell_Squat, hand-checked against src/data/library/exercises.json (E5-T1's bundled
// free-exercise-db data) rather than loaded through loadLibrary(), so a wrong field in the
// fixture below would fail these tests instead of masking a real regression there.
const BARBELL_SQUAT: LibraryExercise = {
  id: 'Barbell_Squat',
  name: 'Barbell Squat',
  force: 'push',
  level: 'beginner',
  mechanic: 'compound',
  equipment: 'barbell',
  primaryMuscles: ['quadriceps'],
  secondaryMuscles: ['calves', 'glutes', 'hamstrings', 'lower back'],
  instructions: [
    'This exercise is best performed inside a squat rack for safety purposes. To begin, first set the bar on a rack to just below shoulder level. Once the correct height is chosen and the bar is loaded, step under the bar and place the back of your shoulders (slightly below the neck) across it.',
    'Hold on to the bar using both arms at each side and lift it off the rack by first pushing with your legs and at the same time straightening your torso.',
    'Step away from the rack and position your legs using a shoulder width medium stance with the toes slightly pointed out. Keep your head up at all times and also maintain a straight back. This will be your starting position. (Note: For the purposes of this discussion we will use the medium stance described above which targets overall development; however you can choose any of the three stances discussed in the foot stances section).',
    'Begin to slowly lower the bar by bending the knees and hips as you maintain a straight posture with the head up. Continue down until the angle between the upper leg and the calves becomes slightly less than 90-degrees. Inhale as you perform this portion of the movement. Tip: If you performed the exercise correctly, the front of the knees should make an imaginary straight line with the toes that is perpendicular to the front. If your knees are past that imaginary line (if they are past your toes) then you are placing undue stress on the knee and the exercise has been performed incorrectly.',
    'Begin to raise the bar as you exhale by pushing the floor with the heel of your foot as you straighten the legs again and go back to the starting position.',
    'Repeat for the recommended amount of repetitions.',
  ],
  category: 'strength',
  images: ['Barbell_Squat/0.jpg', 'Barbell_Squat/1.jpg'],
}

const onBack = () => {}

// L11/L12/L13 predate `library`/`gymEquipment`/`onOpenDetail` (E5-T15): a minimal library and a
// no-op onOpenDetail let their existing render calls keep compiling and behaving the same --
// this is the interface fix the ticket calls for, not a behavior change.
const LIBRARY = new Map<string, LibraryExercise>([[BARBELL_SQUAT.id, BARBELL_SQUAT]])
const onOpenDetail = () => {}

// --- L11: profile, muscles and numbered instructions ---------------------------------------

test('L11 ExerciseDetail shows the exercise name as its heading', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  expect(screen.getByRole('heading', { name: 'Barbell Squat' })).toBeVisible()
})

test('L11 ExerciseDetail shows the primary muscle quadriceps', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  expect(screen.getByText('Primary muscle: quadriceps')).toBeVisible()
})

test('L11 ExerciseDetail shows the secondary muscles in dataset order', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  expect(screen.getByText('Secondary muscles: calves, glutes, hamstrings, lower back')).toBeVisible()
})

test('L11 ExerciseDetail shows equipment, mechanic, force and level', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  expect(screen.getByText('Equipment: barbell')).toBeVisible()
  expect(screen.getByText('Mechanic: compound')).toBeVisible()
  expect(screen.getByText('Force: push')).toBeVisible()
  expect(screen.getByText('Level: beginner')).toBeVisible()
})

test('L11 ExerciseDetail shows the instructions as a numbered list in dataset order', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  const steps = screen.getAllByRole('listitem').map((item) => item.textContent)
  expect(steps).toEqual(BARBELL_SQUAT.instructions)
})

// --- F1: the detail screen renders as a modal popup (fix-popups) ---------------------------
//
// The overlay used to land in normal document flow, below whatever view was showing (an
// 876-row list or the set screen) -- the operator's device-check defect. It is a
// `role="dialog"` / `aria-modal="true"` element named by its own heading, with the existing
// "Back" control inside it.

test('F1 ExerciseDetail is a modal dialog named by the exercise heading', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  const dialog = screen.getByRole('dialog', { name: 'Barbell Squat' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
})

test('F1 ExerciseDetail\'s dialog is named by the heading override rather than the entry\'s own name', () => {
  render(
    <ExerciseDetail
      entry={BARBELL_SQUAT}
      heading="Deadlift"
      photos={[]}
      onBack={onBack}
      library={LIBRARY}
      gymEquipment={null}
      onOpenDetail={onOpenDetail}
    />,
  )

  expect(screen.getByRole('dialog', { name: 'Deadlift' })).toBeInTheDocument()
})

test('F1 the Back control that closes ExerciseDetail is inside its own dialog', async () => {
  const user = userEvent.setup()
  const onBackSpy = vi.fn()
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBackSpy} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  const dialog = screen.getByRole('dialog', { name: 'Barbell Squat' })
  await user.click(within(dialog).getByRole('button', { name: 'Back' }))

  expect(onBackSpy).toHaveBeenCalledTimes(1)
})

// --- F3: the popup layer's shared CSS (fix-popups) ------------------------------------------
//
// `src/styles/overlay.test.ts` audits `.overlay-panel`'s own declarations as data; this proves
// ExerciseDetail's root actually carries that shared class, scoped by the existing
// `.exercise-detail` selector rather than by role, so this fails specifically on the missing
// class and not on a missing dialog role.

test('F3 ExerciseDetail\'s root carries the shared overlay-panel class', () => {
  const { container } = render(
    <ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />,
  )

  const root = container.querySelector('.exercise-detail')
  expect(root, '.exercise-detail must still be the root ExerciseDetail renders').not.toBeNull()
  expect(root).toHaveClass('overlay-panel')
})

// --- L12: the video link and its credit -----------------------------------------------------

const SQUAT_VIDEO: Video = {
  provider: 'youtube',
  id: 'dQw4w9WgXcQ',
  source: 'https://www.muscleandstrength.com/exercises/barbell-squat.html',
}

const LUNGE_VIDEO: Video = {
  provider: 'vimeo',
  id: '877881961',
  source: 'https://www.muscleandstrength.com/exercises/dumbbell-lunge.html',
}

test('L12 ExerciseDetail opens a "Watch video" link to the youtube watch URL in a new tab when given a youtube video', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} video={SQUAT_VIDEO} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  const link = screen.getByRole('link', { name: 'Watch video' })
  expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})

test('L12 ExerciseDetail opens a "Watch video" link to the video\'s own source page in a new tab when given a vimeo video', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} video={LUNGE_VIDEO} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  const link = screen.getByRole('link', { name: 'Watch video' })
  expect(link).toHaveAttribute('href', LUNGE_VIDEO.source)
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})

test('L12 ExerciseDetail shows a "Video: Muscle & Strength" credit linking to the video source page when given a video', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} video={SQUAT_VIDEO} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  const credit = screen.getByRole('link', { name: 'Video: Muscle & Strength' })
  expect(credit).toHaveAttribute('href', SQUAT_VIDEO.source)
  expect(credit).toHaveAttribute('target', '_blank')
  expect(credit).toHaveAttribute('rel', 'noopener noreferrer')
})

test('L12 ExerciseDetail renders neither the "Watch video" link nor its credit when given no video', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  // Anchored to the heading so a stub that renders nothing at all does not pass this
  // negative check vacuously -- the screen must have rendered the exercise for real.
  expect(screen.getByRole('heading', { name: 'Barbell Squat' })).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Watch video' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Video: Muscle & Strength' })).not.toBeInTheDocument()
})

// --- L13: photos and the offline placeholder ------------------------------------------------

test('L13 ExerciseDetail renders each given photo url as an image', () => {
  const photos = [
    '/WorkoutTracker/library-photos/Barbell_Squat/0.jpg',
    '/WorkoutTracker/library-photos/Barbell_Squat/1.jpg',
  ]

  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={photos} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  const images = screen.getAllByRole('img')
  expect(images.map((image) => image.getAttribute('src'))).toEqual(photos)
})

test('L13 ExerciseDetail replaces a photo that fails to load with a "Photos need a connection" placeholder', () => {
  const photos = ['/WorkoutTracker/library-photos/Barbell_Squat/0.jpg']

  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={photos} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />)

  const image = screen.getByRole('img')
  fireEvent.error(image)

  expect(screen.getByText('Photos need a connection')).toBeVisible()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

// --- M10: the body map on the detail screen (E5-T17) ----------------------------------------
//
// BARBELL_SQUAT's primaryMuscles ['quadriceps'] and secondaryMuscles ['calves', 'glutes',
// 'hamstrings', 'lower back'] map through src/domain/muscles.ts's regionsFor one-for-one:
// quadriceps->quadriceps, calves->calves, glutes->gluteal, hamstrings->hamstring, 'lower
// back'->lower-back (hand-checked against MUSCLE_REGIONS there, not computed from it).

test('M10 the detail screen body map shows quadriceps in the primary shade for Barbell_Squat', () => {
  const { container } = render(
    <ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />,
  )

  const quadriceps = container.querySelectorAll('[data-region="quadriceps"][data-shade="primary"]')
  expect(quadriceps.length, 'expected at least one quadriceps shape shaded primary').toBeGreaterThan(0)
})

test('M10 the detail screen body map shows calves, glutes, hamstrings and lower back in the secondary shade for Barbell_Squat', () => {
  const { container } = render(
    <ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} library={LIBRARY} gymEquipment={null} onOpenDetail={onOpenDetail} />,
  )

  for (const region of ['calves', 'gluteal', 'hamstring', 'lower-back']) {
    const elements = container.querySelectorAll(`[data-region="${region}"][data-shade="secondary"]`)
    expect(elements.length, `expected at least one ${region} shape shaded secondary`).toBeGreaterThan(0)
  }
})

// --- S13: "Similar exercises" -----------------------------------------------------------------
//
// A small hand-built library, not the real one, so its `alternativesFor` (E5-T5) ranking is
// hand-checked here rather than trusted: every candidate shares TARGET_CURL's primary muscle
// ('biceps') and is category 'strength', so all 6 pass `alternativesFor`'s muscle/category
// filters, and `equipment: null` on every entry passes its equipment filter regardless of
// `gymEquipment`. Ranking is by mechanic match first, then by how many of TARGET_CURL's
// secondaryMuscles (['forearms', 'shoulders']) a candidate shares, then by name A-Z:
//   Alpha Curl    (isolation, shares 2) -----\
//   Foxtrot Curl  (isolation, shares 2) ------ } shared=2, name order Alpha < Foxtrot
//   Beta Curl     (isolation, shares 1) -----\
//   Charlie Curl  (isolation, shares 1) ------ } shared=1, name order Beta < Charlie
//   Delta Curl    (isolation, shares 0)
//   Echo Curl     (compound -- mechanic mismatch, ranks last regardless of shared count)
// so the top 5 are exactly Alpha, Foxtrot, Beta, Charlie, Delta; Echo Curl is 6th and cut by
// `limit={5}`.

const TARGET_CURL: LibraryExercise = {
  id: 'Target_Curl',
  name: 'Target Curl',
  force: 'pull',
  level: 'beginner',
  mechanic: 'isolation',
  equipment: null,
  primaryMuscles: ['biceps'],
  secondaryMuscles: ['forearms', 'shoulders'],
  instructions: [],
  category: 'strength',
  images: [],
}

function curlCandidate(
  id: string,
  name: string,
  mechanic: LibraryExercise['mechanic'],
  secondaryMuscles: LibraryExercise['secondaryMuscles'],
): LibraryExercise {
  return {
    id,
    name,
    force: 'pull',
    level: 'beginner',
    mechanic,
    equipment: null,
    primaryMuscles: ['biceps'],
    secondaryMuscles,
    instructions: [],
    category: 'strength',
    images: [],
  }
}

const ALPHA_CURL = curlCandidate('Alpha_Curl', 'Alpha Curl', 'isolation', ['forearms', 'shoulders'])
const FOXTROT_CURL = curlCandidate('Foxtrot_Curl', 'Foxtrot Curl', 'isolation', ['forearms', 'shoulders'])
const BETA_CURL = curlCandidate('Beta_Curl', 'Beta Curl', 'isolation', ['forearms'])
const CHARLIE_CURL = curlCandidate('Charlie_Curl', 'Charlie Curl', 'isolation', ['shoulders'])
const DELTA_CURL = curlCandidate('Delta_Curl', 'Delta Curl', 'isolation', [])
const ECHO_CURL = curlCandidate('Echo_Curl', 'Echo Curl', 'compound', ['forearms', 'shoulders'])

const SIMILAR_LIBRARY = new Map<string, LibraryExercise>(
  [TARGET_CURL, ALPHA_CURL, FOXTROT_CURL, BETA_CURL, CHARLIE_CURL, DELTA_CURL, ECHO_CURL].map(
    (exercise) => [exercise.id, exercise],
  ),
)

const TOP_FIVE_NAMES = ['Alpha Curl', 'Foxtrot Curl', 'Beta Curl', 'Charlie Curl', 'Delta Curl']

/** The control a "Similar exercises" row offers to open that alternative's own detail screen --
 * a link or a button, matching `AlternativesList`'s existing `onOpenDetail` row pattern. */
function openControlFor(name: string): HTMLElement {
  return screen.queryByRole('link', { name, exact: true }) ?? screen.getByRole('button', { name, exact: true })
}

/** The row containing `name`'s open control, so a "Do this instead" button can be looked up
 * scoped to that row rather than any other row's. */
function rowFor(name: string): HTMLElement {
  const row = openControlFor(name).closest('li')
  if (!row) throw new Error(`no row list item found for "${name}"`)
  return row
}

test('S13 ExerciseDetail lists its top 5 ranked alternatives under a "Similar exercises" heading', () => {
  render(
    <ExerciseDetail
      entry={TARGET_CURL}
      photos={[]}
      onBack={onBack}
      library={SIMILAR_LIBRARY}
      gymEquipment={null}
      onOpenDetail={onOpenDetail}
    />,
  )

  expect(screen.getByRole('heading', { name: 'Similar exercises' })).toBeVisible()

  for (const name of TOP_FIVE_NAMES) {
    expect(openControlFor(name)).toBeVisible()
  }
  // Echo Curl ranks 6th (mechanic mismatch), cut by the top-5 limit.
  expect(screen.queryByText('Echo Curl')).not.toBeInTheDocument()
})

test('S13 tapping a "Similar exercises" row opens that alternative\'s own detail screen instead of swapping to it', async () => {
  const onOpenDetailSpy = vi.fn()
  const onChoose = vi.fn()
  const user = userEvent.setup()

  render(
    <ExerciseDetail
      entry={TARGET_CURL}
      photos={[]}
      onBack={onBack}
      library={SIMILAR_LIBRARY}
      gymEquipment={null}
      onOpenDetail={onOpenDetailSpy}
      onChoose={onChoose}
    />,
  )

  await user.click(openControlFor('Alpha Curl'))

  expect(onOpenDetailSpy).toHaveBeenCalledWith('Alpha_Curl')
  expect(onChoose).not.toHaveBeenCalled()
})

test('S13 no "Similar exercises" row offers "Do this instead" when ExerciseDetail is opened without onChoose', () => {
  render(
    <ExerciseDetail
      entry={TARGET_CURL}
      photos={[]}
      onBack={onBack}
      library={SIMILAR_LIBRARY}
      gymEquipment={null}
      onOpenDetail={onOpenDetail}
    />,
  )

  // Anchored to the rows actually rendering, so a stub that shows no "Similar exercises"
  // section at all does not pass this negative check vacuously.
  expect(screen.getByRole('heading', { name: 'Similar exercises' })).toBeVisible()
  for (const name of TOP_FIVE_NAMES) {
    expect(openControlFor(name)).toBeVisible()
  }
  expect(screen.queryByRole('button', { name: 'Do this instead' })).not.toBeInTheDocument()
})

test('S13 every "Similar exercises" row offers "Do this instead" when ExerciseDetail is opened from a live set, and tapping it calls onChoose with that row\'s id', async () => {
  const onChoose = vi.fn()
  const user = userEvent.setup()

  render(
    <ExerciseDetail
      entry={TARGET_CURL}
      photos={[]}
      onBack={onBack}
      library={SIMILAR_LIBRARY}
      gymEquipment={null}
      onOpenDetail={onOpenDetail}
      onChoose={onChoose}
    />,
  )

  for (const name of TOP_FIVE_NAMES) {
    expect(within(rowFor(name)).getByRole('button', { name: 'Do this instead' })).toBeVisible()
  }

  await user.click(within(rowFor('Beta Curl')).getByRole('button', { name: 'Do this instead' }))

  expect(onChoose).toHaveBeenCalledWith('Beta_Curl')
})
