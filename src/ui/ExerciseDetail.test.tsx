import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
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

// --- L11: profile, muscles and numbered instructions ---------------------------------------

test('L11 ExerciseDetail shows the exercise name as its heading', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} />)

  expect(screen.getByRole('heading', { name: 'Barbell Squat' })).toBeVisible()
})

test('L11 ExerciseDetail shows the primary muscle quadriceps', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} />)

  expect(screen.getByText('Primary muscle: quadriceps')).toBeVisible()
})

test('L11 ExerciseDetail shows the secondary muscles in dataset order', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} />)

  expect(screen.getByText('Secondary muscles: calves, glutes, hamstrings, lower back')).toBeVisible()
})

test('L11 ExerciseDetail shows equipment, mechanic, force and level', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} />)

  expect(screen.getByText('Equipment: barbell')).toBeVisible()
  expect(screen.getByText('Mechanic: compound')).toBeVisible()
  expect(screen.getByText('Force: push')).toBeVisible()
  expect(screen.getByText('Level: beginner')).toBeVisible()
})

test('L11 ExerciseDetail shows the instructions as a numbered list in dataset order', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} />)

  const steps = screen.getAllByRole('listitem').map((item) => item.textContent)
  expect(steps).toEqual(BARBELL_SQUAT.instructions)
})

// --- L12: the video link and its credit -----------------------------------------------------

const SQUAT_VIDEO: Video = {
  youtubeId: 'dQw4w9WgXcQ',
  source: 'https://www.muscleandstrength.com/exercises/barbell-squat.html',
}

test('L12 ExerciseDetail opens a "Watch video" link to the youtube watch URL in a new tab when given a video', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} video={SQUAT_VIDEO} photos={[]} onBack={onBack} />)

  const link = screen.getByRole('link', { name: 'Watch video' })
  expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})

test('L12 ExerciseDetail shows a "Video: Muscle & Strength" credit linking to the video source page when given a video', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} video={SQUAT_VIDEO} photos={[]} onBack={onBack} />)

  const credit = screen.getByRole('link', { name: 'Video: Muscle & Strength' })
  expect(credit).toHaveAttribute('href', SQUAT_VIDEO.source)
  expect(credit).toHaveAttribute('target', '_blank')
  expect(credit).toHaveAttribute('rel', 'noopener noreferrer')
})

test('L12 ExerciseDetail renders neither the "Watch video" link nor its credit when given no video', () => {
  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={[]} onBack={onBack} />)

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

  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={photos} onBack={onBack} />)

  const images = screen.getAllByRole('img')
  expect(images.map((image) => image.getAttribute('src'))).toEqual(photos)
})

test('L13 ExerciseDetail replaces a photo that fails to load with a "Photos need a connection" placeholder', () => {
  const photos = ['/WorkoutTracker/library-photos/Barbell_Squat/0.jpg']

  render(<ExerciseDetail entry={BARBELL_SQUAT} photos={photos} onBack={onBack} />)

  const image = screen.getByRole('img')
  fireEvent.error(image)

  expect(screen.getByText('Photos need a connection')).toBeVisible()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
