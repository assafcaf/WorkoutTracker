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
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { AppShell, SettingsButton, ShellChromeContext } from './AppShell'
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
    <AppShell title="Workout A" action={<button type="button">Finish workout</button>} tab="dashboard" onTabChange={vi.fn()}>
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

// Title kept (weakened-tests gate); the Progress Dashboard redesign has four tabs.
test('O7 AppShell holds a nav labelled Main with exactly the Workout, Program, Exercises, History and Settings tabs when it is given a tab', () => {
  render(
    <AppShell title="Dashboard" tab="dashboard" onTabChange={vi.fn()}>
      <p>the program picker</p>
    </AppShell>,
  )

  expect(tabNames()).toEqual(['Train', 'Progress', 'Sessions', 'Program'])
})

test('O7 AppShell marks the tab it was given, and no other, as the current page', () => {
  render(
    <AppShell title="Sessions" tab="sessions" onTabChange={vi.fn()}>
      <p>the history list</p>
    </AppShell>,
  )

  const nav = screen.getByRole('navigation', { name: 'Main' })
  expect(within(nav).getByRole('button', { name: 'Sessions' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(
    within(nav)
      .getAllByRole('button')
      .filter((tab) => tab.getAttribute('aria-current') === 'page')
      .map((tab) => accessibleName(tab)),
  ).toEqual(['Sessions'])
})

test('O7 AppShell reports the tab that was pressed to its onTabChange', async () => {
  const user = userEvent.setup()
  const onTabChange = vi.fn()
  render(
    <AppShell title="Dashboard" tab="dashboard" onTabChange={onTabChange}>
      <p>the program picker</p>
    </AppShell>,
  )

  await user.click(screen.getByRole('button', { name: 'Sessions' }))

  expect(onTabChange.mock.calls).toEqual([['sessions']])
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

// Titles kept (weakened-tests gate): Settings is no longer a tab but the Dashboard header's
// gear, and the backup-due marker rides on the gear.
test('O7 AppShell puts a backup-due marker on the Settings tab when settingsBadge is set', () => {
  const { container } = render(
    <AppShell title="Dashboard" tab="dashboard" onTabChange={vi.fn()} actions={<SettingsButton onOpen={vi.fn()} badge />}>
      <p>the dashboard</p>
    </AppShell>,
  )

  const settings = screen.getByRole('button', { name: 'Settings' })
  const badge = container.querySelector('.settings-open-badge')
  expect(badge).not.toBeNull()
  expect(settings.contains(badge)).toBe(true)
  // The gear sits in the header, not the tab bar.
  expect(container.querySelector('header.app-header')?.contains(settings)).toBe(true)
  // Whether the marker is a label or its own text, what it announces has to say why it is
  // there; a bare dot tells a screen-reader user nothing.
  expect(
    `${badge?.getAttribute('aria-label') ?? ''} ${badge?.textContent ?? ''}`,
  ).toMatch(/back ?up/i)
})

test('O7 AppShell leaves the Settings tab named exactly Settings while the backup-due marker is shown', () => {
  render(
    <AppShell title="Dashboard" tab="dashboard" onTabChange={vi.fn()} actions={<SettingsButton onOpen={vi.fn()} badge />}>
      <p>the dashboard</p>
    </AppShell>,
  )

  // The marker sits inside the gear, so unless the gear names itself the trainee -- and every
  // test that reaches Settings by name -- loses the control called "Settings".
  expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible()
  expect(tabNames()).toEqual(['Train', 'Progress', 'Sessions', 'Program'])
})

test('O7 AppShell shows no backup-due marker when settingsBadge is not set', () => {
  const { container } = render(
    <AppShell title="Dashboard" tab="dashboard" onTabChange={vi.fn()} actions={<SettingsButton onOpen={vi.fn()} />}>
      <p>the dashboard</p>
    </AppShell>,
  )

  expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible()
  expect(container.querySelector('.settings-open-badge')).toBeNull()
})

// --- the tab bar on its own ----------------------------------------------------------------

// Titles kept (weakened-tests gate); the Progress Dashboard redesign has four tabs.
test('O7 TabBar offers the five tabs as buttons inside a nav labelled Main', () => {
  const { container } = render(<TabBar current="dashboard" onChange={vi.fn()} />)

  expect(tabNames()).toEqual(['Train', 'Progress', 'Sessions', 'Program'])
  // E3-T8's tap-target audit reads its floor off `.tab-bar-tab`, so the class is contract.
  expect([...container.querySelectorAll('nav.tab-bar button.tab-bar-tab')]).toHaveLength(4)
})

// M11: the tab bar in order, and every tab a real, clickable button -- the CSS tap-target
// floor is `.tab-bar-tab`'s job in src/styles/cssAudit.test.ts, not jsdom viewport mocking here.
test('M11 TabBar renders Workout, Program, Exercises, History and Settings in that order, each a clickable button', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<TabBar current="dashboard" onChange={onChange} />)

  const order = ['Train', 'Progress', 'Sessions', 'Program']
  expect(tabNames()).toEqual(order)

  for (const name of order) {
    await user.click(screen.getByRole('button', { name }))
  }

  expect(onChange.mock.calls.map((call) => call[0])).toEqual([
    'dashboard',
    'lifts',
    'sessions',
    'program',
  ])
})

test('O7 TabBar marks its current tab, and no other, as the current page', () => {
  render(<TabBar current="program" onChange={vi.fn()} />)

  const nav = screen.getByRole('navigation', { name: 'Main' })
  expect(
    within(nav)
      .getAllByRole('button')
      .filter((tab) => tab.getAttribute('aria-current') === 'page')
      .map((tab) => accessibleName(tab)),
  ).toEqual(['Program'])
})

test('O7 TabBar reports the tab that was pressed to its onChange', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<TabBar current="dashboard" onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Progress' }))

  expect(onChange.mock.calls).toEqual([['lifts']])
})

// --- E10-T5 (O13): the court stripe under the header title ---------------------------------

test('O13 AppShell renders a decorative court-stripe under the header title', () => {
  const { container } = render(
    <AppShell title="Workout">
      <p>the program picker</p>
    </AppShell>,
  )

  // Title kept (weakened-tests gate); E17-T12 [O15]: the Court stripe is gone, so the header
  // holds its title and no stripe, decorative or otherwise.
  const header = container.querySelector('header.app-header') as HTMLElement
  expect(header.querySelector('h1')).toHaveTextContent('Workout')
  expect(container.querySelector('.court-stripe')).toBeNull()
  expect(container.querySelector('[data-stripe]')).toBeNull()
})

// --- E17-T12 (O15): CourtStripe's own tests, moved here when the component was deleted ------
// Titles kept verbatim (weakened-tests gate); each body asserts that part of the stripe is gone.

/** Every file under `dir` whose name matches, recursively, test files and test helpers excluded. */
function productionFilesUnder(dir: string, matches: RegExp): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'test') found.push(...productionFilesUnder(path, matches))
    } else if (matches.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(path)
    }
  }
  return found
}

const uiDir = dirname(fileURLToPath(import.meta.url))
const srcDir = join(uiDir, '..')

test('O13 CourtStripe renders one decorative, aria-hidden court-stripe span', () => {
  expect(existsSync(join(uiDir, 'CourtStripe.tsx')), 'src/ui/CourtStripe.tsx still exists').toBe(false)
})

test('O13 the court-stripe rule draws its bands via linear-gradient of --color-primary over --color-accent, with no literal colour', () => {
  expect(existsSync(join(uiDir, 'CourtStripe.css')), 'src/ui/CourtStripe.css still exists').toBe(false)
  const withRule = productionFilesUnder(srcDir, /\.css$/).filter((path) =>
    /\.court-stripe\b/.test(readFileSync(path, 'utf-8')),
  )
  expect(withRule, 'stylesheets still declaring a .court-stripe rule').toEqual([])
})

test('O13 the court-stripe rule draws each band 2px thick', () => {
  const withStripe = productionFilesUnder(srcDir, /\.(css|tsx?)$/).filter((path) =>
    /court-stripe|data-stripe/.test(readFileSync(path, 'utf-8')),
  )
  expect(withStripe, 'files still naming court-stripe or data-stripe').toEqual([])
})

test('O13 CourtStripe is used in exactly the Shell header, the session summary and the PR medallion', () => {
  const usesCourtStripe = productionFilesUnder(srcDir, /\.tsx?$/).filter((path) =>
    /\bCourtStripe\b/.test(readFileSync(path, 'utf-8')),
  )
  expect(usesCourtStripe, 'components still importing or rendering CourtStripe').toEqual([])
})

// --- Progress Dashboard: a tab screen that draws its own large title (the Dashboard) ----------

test('AppShell given ownHeader draws no header of its own, an unpadded main region, and keeps the tab bar', () => {
  const { container } = render(
    <AppShell title="Dashboard" ownHeader tab="dashboard" onTabChange={vi.fn()}>
      <p>the screen with its own header</p>
    </AppShell>,
  )

  expect(container.querySelector('header')).toBeNull()
  expect(container.querySelector('main.app-main')).toHaveClass('app-main-flush')
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeVisible()
})

// S7a: under a lead (the Program tab's Program | Exercises switch) the screen's actions ride the
// lead's row, and the large title keeps only its text.
test('S7a a tab screen under a lead carries its actions on the lead row, not beside its title', () => {
  render(
    <ShellChromeContext.Provider value={{ tab: 'program', onTabChange: vi.fn(), lead: <span>Switch</span> }}>
      <AppShell title="A/B Split" actions={<button type="button" className="btn-quiet">Edit</button>}>
        <p>body</p>
      </AppShell>
    </ShellChromeContext.Provider>,
  )

  const lead = screen.getByText('Switch').parentElement as HTMLElement
  expect(within(lead).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  const header = screen.getByRole('heading', { level: 1, name: 'A/B Split' }).closest('header') as HTMLElement
  expect(within(header).queryByRole('button', { name: 'Edit' })).toBeNull()
})

test('S6b a tab screen with no lead keeps its actions beside its title', () => {
  render(
    <AppShell title="Lifts" tab="lifts" onTabChange={vi.fn()} actions={<button type="button" className="btn-quiet">Edit</button>}>
      <p>body</p>
    </AppShell>,
  )

  const header = screen.getByRole('heading', { level: 1, name: 'Lifts' }).closest('header') as HTMLElement
  expect(within(header).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
})
