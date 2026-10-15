import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { ProgressFeature } from './ProgressFeature'
import type { ProgressPage, ProgressPages } from './pages'

type FakeProps = {
  label: string
  next?: ProgressPage
  onBack: (() => void) | undefined
  push(page: ProgressPage): void
}

function Fake({ label, next, onBack, push }: FakeProps): JSX.Element {
  return (
    <div>
      <p>{label}</p>
      {next ? <button onClick={() => push(next)}>Open next</button> : null}
      {onBack ? <button onClick={onBack}>Back</button> : null}
    </div>
  )
}

const pages: ProgressPages = {
  home: (p) => <Fake label="home" next={{ kind: 'lifts' }} onBack={p.onBack} push={p.push} />,
  lifts: (p) => <Fake label="lifts" next={{ kind: 'lift', exerciseId: 'squat' }} onBack={p.onBack} push={p.push} />,
  lift: (p) => <Fake label={`lift ${p.page.exerciseId}`} onBack={p.onBack} push={p.push} />,
  muscles: (p) => <Fake label="muscles" onBack={p.onBack} push={p.push} />,
}

test('the group opens on the home page with no Back', () => {
  render(<ProgressFeature pages={pages} />)
  expect(screen.getByText('home')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
})

test('a page pushes over the last and Back returns each step', async () => {
  const user = userEvent.setup()
  render(<ProgressFeature pages={pages} />)

  await user.click(screen.getByRole('button', { name: 'Open next' }))
  expect(screen.getByText('lifts')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Open next' }))
  expect(screen.getByText('lift squat')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByText('lifts')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByText('home')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
})
