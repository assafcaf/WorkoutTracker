// E3-T3: the one shell every tab screen renders inside, and the tab bar it holds.
//
// [O7] is an App-level outcome and is proven end to end in src/App.test.tsx; what is proven
// here is the shell's own contract, because App is not the only caller. E3-T4 wraps the
// in-session screens in it, E3-T5 puts the resume card in it, and E3-T7 hands it `trailing`
// (the update pill) and `settingsBadge` (the backup-due marker) — so the whole `AppShellProps`
// surface has to hold before any of those tasks can lean on it.
//
// Nothing is mocked: AppShell and TabBar are presentational and hold no state, so these tests
// render the real components and read what a trainee would see.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { AppShell } from './AppShell'
import { TabBar } from './TabBar'

/**
 * What a screen reader would announce an element as: its `aria-label` when it has one, and
 * otherwise its text, whitespace-collapsed.
 */
function accessibleName(element: Element): string {
  return (element.getAttribute('aria-label') ?? element.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The Main nav's tabs, in document order, by the name each one carries. */
function tabNames(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Main' })
  return within(nav)
    .getAllByRole('button')
    .map((tab) => accessibleName(tab))
}

// --- the header, the main region and the action bar ---------------------------------------

test('O7 AppShell shows its title in the header', () => {
  const { container } = render(
    <AppShell title="Workout">
      <p>the program picker</p>
    </AppShell>,
  )

  const header = container.querySelector('header.app-header')
  expect(header).not.toBeNull()
  expect(header?.textContent).toContain('Workout')
})

test('O7 AppShell renders the screen it was given inside the main region', () => {
  const { container } = render(
    <AppShell title="Workout">
      <p>the program picker</p>
    </AppShell>,
  )

  const main = container.querySelector('main.app-main')
  expect(main).not.toBeNull()
  expect(within(main as HTMLElement).getByText('the program picker')).toBeVisible()
})

test('O7 AppShell lays the header, the main region, the action bar and the tab bar out in that order', () => {
  const { container } = render(
    <AppShell title="Workout A" action={<button type="button">Finish workout</button>} tab="workout" onTabChange={vi.fn()}>
      <p>the exercise list</p>
    </AppShell>,
  )

  const parts = [
    ...container.querySelectorAll('header.app-header, main.app-main, .action-bar, nav.tab-bar'),
  ]
  /** Which of the shell's four parts an element is, so extra classes on it do not matter. */
  function partName(element: Element): string {
    if (element.matches('header.app-header')) return 'header'
    if (element.matches('main.app-main')) return 'main'
    if (element.matches('nav.tab-bar')) return 'tab bar'
    return 'action bar'
  }

  // A shell that renders the tab bar above the content, or the action bar over the header,
  // reads as a different screen however right each part is on its own.
  expect(parts.map(partName)).toEqual(['header', 'main', 'action bar', 'tab bar'])
})

test('O7 AppShell offers a back control in the header when it is given an onBack', () => {
  const { container } = render(
    <AppShell title="Back squat" onBack={vi.fn()}>
      <p>the set screen</p>
    </AppShell>,
  )

  const back = container.querySelector('header.app-header button.app-header-back')
  expect(back).not.toBeNull()
  expect(accessibleName(back as HTMLElement)).toMatch(/back/i)
})

test('O7 AppShell runs its onBack when the back control is pressed', async () => {
  const user = userEvent.setup()
  const onBack = vi.fn()
  const { container } = render(
    <AppShell title="Back squat" onBack={onBack}>
      <p>the set screen</p>
    </AppShell>,
  )

  await user.click(container.querySelector('button.app-header-back') as HTMLElement)

  expect(onBack).toHaveBeenCalledTimes(1)
})

test('O7 AppShell offers no back control when it is given no onBack', () => {
  const { container } = render(
    <AppShell title="Workout">
      <p>the program picker</p>
    </AppShell>,
  )

  // The header is there; what is not there is a way back out of a screen that has nowhere to
  // go back to.
  const header = container.querySelector('header.app-header')
  expect(header).not.toBeNull()
  expect(header?.textContent).toContain('Workout')
  expect(container.querySelector('button.app-header-back')).toBeNull()
})

test('O7 AppShell renders the trailing slot in the header', () => {
  const { container } = render(
    <AppShell title="Workout" trailing={<button type="button">Update ready</button>}>
      <p>the program picker</p>
    </AppShell>,
  )

  const header = container.querySelector('header.app-header')
  expect(header).not.toBeNull()
  expect(within(header as HTMLElement).getByRole('button', { name: 'Update ready' })).toBeVisible()
})

test('O7 AppShell renders the action it was given inside the action bar', () => {
  const { container } = render(
    <AppShell title="Workout A" action={<button type="button">Finish workout</button>}>
      <p>the exercise list</p>
    </AppShell>,
  )

  const actionBar = container.querySelector('.action-bar')
  expect(actionBar).not.toBeNull()
  expect(
    within(actionBar as HTMLElement).getByRole('button', { name: 'Finish workout' }),
  ).toBeVisible()
})

test('O7 AppShell renders no action bar when it is given no action', () => {
  const { container } = render(
    <AppShell title="Workout">
      <p>the program picker</p>
    </AppShell>,
  )

  const main = container.querySelector('main.app-main')
  expect(main).not.toBeNull()
  expect(main?.textContent).toContain('the program picker')
  expect(container.querySelector('.action-bar')).toBeNull()
})

// --- the tab bar the shell holds -----------------------------------------------------------

// E5-T18 (M11) inserts Program between Workout and Exercises.
test('O7 AppShell holds a nav labelled Main with exactly the Workout, Program, Exercises, History and Settings tabs when it is given a tab', () => {
  render(
    <AppShell title="Workout" tab="workout" onTabChange={vi.fn()}>
      <p>the program picker</p>
    </AppShell>,
  )

  expect(tabNames()).toEqual(['Workout', 'Program', 'Exercises', 'History', 'Settings'])
})

test('O7 AppShell marks the tab it was given, and no other, as the current page', () => {
  render(
    <AppShell title="History" tab="history" onTabChange={vi.fn()}>
      <p>the history list</p>
    </AppShell>,
  )

  const nav = screen.getByRole('navigation', { name: 'Main' })
  expect(within(nav).getByRole('button', { name: 'History' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(
    within(nav)
      .getAllByRole('button')
      .filter((tab) => tab.getAttribute('aria-current') === 'page')
      .map((tab) => accessibleName(tab)),
  ).toEqual(['History'])
})

test('O7 AppShell reports the tab that was pressed to its onTabChange', async () => {
  const user = userEvent.setup()
  const onTabChange = vi.fn()
  render(
    <AppShell title="Workout" tab="workout" onTabChange={onTabChange}>
      <p>the program picker</p>
    </AppShell>,
  )

  await user.click(screen.getByRole('button', { name: 'History' }))

  expect(onTabChange.mock.calls).toEqual([['history']])
})

test('O7 AppShell renders no tab bar when it is given no tab', () => {
  const { container } = render(
    <AppShell title="Back squat">
      <p>the set screen</p>
    </AppShell>,
  )

  // An in-session screen is the shell without a tab bar: the content is still there, the way
  // out of the session is not.
  const main = container.querySelector('main.app-main')
  expect(main).not.toBeNull()
  expect(main?.textContent).toContain('the set screen')
  expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
})

test('O7 AppShell puts a backup-due marker on the Settings tab when settingsBadge is set', () => {
  const { container } = render(
    <AppShell title="Settings" tab="settings" onTabChange={vi.fn()} settingsBadge>
      <p>the settings screen</p>
    </AppShell>,
  )

  const settings = screen.getByRole('button', { name: 'Settings' })
  const badge = container.querySelector('.tab-bar-badge')
  expect(badge).not.toBeNull()
  expect(settings.contains(badge)).toBe(true)
  // Whether the marker is a label or its own text, what it announces has to say why it is
  // there; a bare dot tells a screen-reader user nothing.
  expect(
    `${badge?.getAttribute('aria-label') ?? ''} ${badge?.textContent ?? ''}`,
  ).toMatch(/back ?up/i)
})

test('O7 AppShell leaves the Settings tab named exactly Settings while the backup-due marker is shown', () => {
  render(
    <AppShell title="Settings" tab="settings" onTabChange={vi.fn()} settingsBadge>
      <p>the settings screen</p>
    </AppShell>,
  )

  // The marker sits inside the tab, so unless the tab names itself the trainee -- and every
  // test that reaches Settings by name -- loses the control called "Settings".
  expect(tabNames()).toEqual(['Workout', 'Program', 'Exercises', 'History', 'Settings'])
})

test('O7 AppShell shows no backup-due marker when settingsBadge is not set', () => {
  const { container } = render(
    <AppShell title="Settings" tab="settings" onTabChange={vi.fn()}>
      <p>the settings screen</p>
    </AppShell>,
  )

  expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  expect(container.querySelector('.tab-bar-badge')).toBeNull()
})

// --- the tab bar on its own ----------------------------------------------------------------

test('O7 TabBar offers the five tabs as buttons inside a nav labelled Main', () => {
  const { container } = render(<TabBar current="workout" onChange={vi.fn()} />)

  expect(tabNames()).toEqual(['Workout', 'Program', 'Exercises', 'History', 'Settings'])
  // E3-T8's tap-target audit reads its floor off `.tab-bar-tab`, so the class is contract.
  expect([...container.querySelectorAll('nav.tab-bar button.tab-bar-tab')]).toHaveLength(5)
})

// M11: the tab bar in order, and every tab a real, clickable button -- the CSS tap-target
// floor is `.tab-bar-tab`'s job in src/styles/cssAudit.test.ts, not jsdom viewport mocking here.
test('M11 TabBar renders Workout, Program, Exercises, History and Settings in that order, each a clickable button', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<TabBar current="workout" onChange={onChange} />)

  const order = ['Workout', 'Program', 'Exercises', 'History', 'Settings']
  expect(tabNames()).toEqual(order)

  for (const name of order) {
    await user.click(screen.getByRole('button', { name }))
  }

  expect(onChange.mock.calls.map((call) => call[0])).toEqual([
    'workout',
    'program',
    'exercises',
    'history',
    'settings',
  ])
})

test('O7 TabBar marks its current tab, and no other, as the current page', () => {
  render(<TabBar current="settings" onChange={vi.fn()} />)

  const nav = screen.getByRole('navigation', { name: 'Main' })
  expect(
    within(nav)
      .getAllByRole('button')
      .filter((tab) => tab.getAttribute('aria-current') === 'page')
      .map((tab) => accessibleName(tab)),
  ).toEqual(['Settings'])
})

test('O7 TabBar reports the tab that was pressed to its onChange', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<TabBar current="workout" onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Settings' }))

  expect(onChange.mock.calls).toEqual([['settings']])
})
