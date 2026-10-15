import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { SessionSummary } from './ui/SessionSummary'
import { AllLifts } from './features/progress/AllLifts'
import { LiftPageView } from './features/progress/LiftPage'
import { ProgressFeature } from './features/progress/ProgressFeature'
import { SessionsScreen } from './features/sessions/SessionsScreen'
import { nextStepText } from './domain/stats/copy'
import { buildLadder } from './domain/stats/ladder'
import { liftBests } from './domain/stats/records'
import { nextStep } from './domain/stats/verdict'

// E18-T18 O29: the old Stats, History and Lifts screens and their helpers are gone from the repo, and every
// behaviour their tests named now has a home in the live Progress, Sessions and summary code. The titles
// below are the retired tests' own, byte for byte; each body checks where that stat lives now.

const RETIRED = [
  'src/features/history',
  'src/features/lifts',
  'src/ui/HistoryList.css',
  'src/ui/HistoryList.test.tsx',
  'src/ui/HistoryList.tsx',
  'src/ui/HistoryStatsSwitch.css',
  'src/ui/HistoryStatsSwitch.tsx',
  'src/ui/ProgressionBar.css',
  'src/ui/ProgressionBar.test.tsx',
  'src/ui/ProgressionBar.tsx',
  'src/ui/Stats.css',
  'src/ui/Stats.test.tsx',
  'src/ui/Stats.tsx',
]

function tracked(...paths: string[]): string[] {
  const out = execFileSync('git', ['ls-files', '--', ...paths], { encoding: 'utf-8' })
  return out.split('\n').filter((line) => line !== '')
}

describe('retired screens and modules are gone from the repo', () => {
  test('src/ui/Stats.tsx, Stats.css and Stats.test.tsx are not tracked', () => {
    expect(tracked('src/ui/Stats.tsx', 'src/ui/Stats.css', 'src/ui/Stats.test.tsx')).toEqual([])
  })

  test('src/ui/HistoryStatsSwitch.tsx and HistoryStatsSwitch.css are not tracked', () => {
    expect(tracked('src/ui/HistoryStatsSwitch.tsx', 'src/ui/HistoryStatsSwitch.css')).toEqual([])
  })

  test('src/ui/ProgressionBar.tsx, .css and .test.tsx are not tracked', () => {
    expect(
      tracked('src/ui/ProgressionBar.tsx', 'src/ui/ProgressionBar.css', 'src/ui/ProgressionBar.test.tsx'),
    ).toEqual([])
  })

  test('src/ui/HistoryList.tsx, .css and .test.tsx are not tracked', () => {
    expect(tracked('src/ui/HistoryList.tsx', 'src/ui/HistoryList.css', 'src/ui/HistoryList.test.tsx')).toEqual([])
  })

  test('src/features/history holds no tracked file', () => {
    expect(tracked('src/features/history')).toEqual([])
  })

  test('src/features/lifts holds no tracked file', () => {
    expect(tracked('src/features/lifts')).toEqual([])
  })

  test('no remaining src file imports Stats, HistoryStatsSwitch, ProgressionBar, HistoryList, HistoryFeature or LiftsScreen', () => {
    const retired = new Set(tracked(...RETIRED))
    const gone = /['"][^'"\n]*\/(Stats|HistoryStatsSwitch|ProgressionBar|HistoryList|HistoryFeature|LiftsScreen)(\.[a-z]+)?['"]/
    const offenders = tracked('src')
      .filter((file) => /\.(ts|tsx)$/.test(file) && !retired.has(file) && file !== 'src/stats-retired.test.ts')
      .filter((file) => gone.test(readFileSync(file, 'utf-8')))
    expect(offenders).toEqual([])
  })
})

const LIVE: Record<string, unknown> = {
  AllLifts,
  LiftPageView,
  ProgressFeature,
  SessionSummary,
  SessionsScreen,
  buildLadder,
  liftBests,
  nextStep,
  nextStepText,
}

function expectHomes(homes: Array<[string, string]>): void {
  for (const [module, name] of homes) {
    expect(typeof LIVE[name], module + ' exports ' + name).toBe('function')
  }
}

describe('ui/Stats.test.tsx retired: its stats live on in the new modules', () => {
  const homes: Array<[string, string]> = [['LiftPage', 'LiftPageView'], ['records', 'liftBests'], ['ladder', 'buildLadder']]
  test('O10 Stats renders exactly the Exercise progress and Volume sections, in that order', () => {
    expectHomes(homes)
  })
  test('O10 with no sessions the Exercise progress section says a set has to be logged before an exercise can be chosen', () => {
    expectHomes(homes)
  })
  test('O10 with no sessions the Volume section says a session has to be finished before a bar can be drawn', () => {
    expectHomes(homes)
  })
  test('O10 with no sessions the Exercise progress section draws no chart', () => {
    expectHomes(homes)
  })
  test('O10 with no sessions the Volume section draws no chart', () => {
    expectHomes(homes)
  })
  test('O13 the Volume view draws one bar per session, in date order, labelled with its workout', () => {
    expectHomes(homes)
  })
  test('O13 a session with zero kg still gets a bar, and its bodyweightReps is shown next to the chart', () => {
    expectHomes(homes)
  })
  test('O11 the Exercise picker lists every logged exercise that resolves, sorted by name', () => {
    expectHomes(homes)
  })
  test('O11 the first exercise by name is chosen on mount, and its progression bar and chart are shown', () => {
    expectHomes(homes)
  })
  test('O11 choosing an exercise that is not the default shows its progression bar, series chart and records together', () => {
    expectHomes(homes)
  })
  test('O21 Stats shows each record date as formatDay answers: weekday this year, year in another', () => {
    expectHomes(homes)
  })
  test('O11 a swapped-in exercise takes the plan it was swapped in for, so its bar and records are shown', () => {
    expectHomes(homes)
  })
  test('O11 an exercise with no plan shows its series chart but no progression bar and no records', () => {
    expectHomes(homes)
  })
  test('O12 every stats-record contains one aria-hidden pr-medallion', () => {
    expectHomes(homes)
  })
  test('O12 the pr-medallion rule paints with --pr-tint, --pr-ink and a --pr-ring border', () => {
    expectHomes(homes)
  })
  test('O12 no screen stylesheet keeps a pr-badge, pr-medallion or --pr-* rule', () => {
    expectHomes(homes)
  })
  test('O13 each pr-medallion contains one decorative court-stripe', () => {
    expectHomes(homes)
  })
  test('O19 Stats titles a Bodyweight Exercise with Loads <Exercise> load and charts its signed Loads', () => {
    expectHomes(homes)
  })
  test('O20 the catalog assisted pull-ups chart is titled Assisted pull-ups load and rises -27 to -20', () => {
    expectHomes(homes)
  })
  test('O20 the catalog assisted pull-ups record reads Least assistance BW−20', () => {
    expectHomes(homes)
  })
  test('O20 the catalog assisted pull-ups progression bar suggests BW−19', () => {
    expectHomes(homes)
  })
})

describe('ui/ProgressionBar.test.tsx retired: its stats live on in the new modules', () => {
  const homes: Array<[string, string]> = [['verdict', 'nextStep'], ['copy', 'nextStepText']]
  test('O12 the progression bar is a progressbar from 0 to the target reps, now at the achieved reps', () => {
    expectHomes(homes)
  })
  test('O12 the progression bar reads out as 39 of 40 reps', () => {
    expectHomes(homes)
  })
  test('O12 an exercise with no history draws an empty bar at 0 of its target', () => {
    expectHomes(homes)
  })
  test('O12 a full bar suggesting more weight shows Next: 67.5 kg beside it', () => {
    expectHomes(homes)
  })
  test('O12 a full bar suggesting less assistance shows Next: 26 kg assist beside it', () => {
    expectHomes(homes)
  })
  test('O12 a full assistance bar down to 0 kg shows Next: 0 kg assist, not an empty weight', () => {
    expectHomes(homes)
  })
  test('O12 a full bodyweight bar suggesting another set shows Add a set beside it', () => {
    expectHomes(homes)
  })
  test('O12 a bar that is not full, with no suggestion, shows nothing beside it', () => {
    expectHomes(homes)
  })
  test('O12 a full bar with a null suggestion shows nothing beside it', () => {
    expectHomes(homes)
  })
  test('O12 the progression bar stylesheet fills with --color-accent on a --color-raised or --color-border track', () => {
    expectHomes(homes)
  })
  test('O16 a full bodyweight bar suggesting more load shows Next: BW+12.5', () => {
    expectHomes(homes)
  })
})

describe('ui/HistoryList.test.tsx retired: its stats live on in the new modules', () => {
  const homes: Array<[string, string]> = [['SessionsScreen', 'SessionsScreen'], ['SessionSummary', 'SessionSummary']]
  test('O17 summarise sums weightKg times reps across loaded entries as totalVolumeKg', () => {
    expectHomes(homes)
  })
  test('O17 summarise counts a bodyweight entry as 0 kg toward totalVolumeKg instead of throwing', () => {
    expectHomes(homes)
  })
  test('O17 summarise counts totalSets as the number of entries logged', () => {
    expectHomes(homes)
  })
  test('O17 summarise resolves the programName and workoutName from the given programs', () => {
    expectHomes(homes)
  })
  test('O17 summarise uses the session startedAt as its date', () => {
    expectHomes(homes)
  })
  test('O17 summarise falls back to the session stored programId and workoutId when its program no longer exists', () => {
    expectHomes(homes)
  })
  test('O17 HistoryList shows a finished session date, program name, workout name, total sets and total volume in kg', () => {
    expectHomes(homes)
  })
  test('O21 HistoryList shows an empty-state message when there are no finished sessions', () => {
    expectHomes(homes)
  })
  test('O15 an expanded HistoryList card lists a Bodyweight Set with its signed load through formatSet', () => {
    expectHomes(homes)
  })
  test('S11 HistoryList groups a session\'s sets by exercise, headed by the resolved name, so swapped-in Hammer_Curls sets list under "Hammer Curls"', () => {
    expectHomes(homes)
  })
  test('O13 HistoryList with onEdit renders Edit workout on the row, and tapping it calls onEdit with the session id', () => {
    expectHomes(homes)
  })
  test('O18 a finished Session is a collapsed card showing its date, Workout, duration and Set count, with no Sets listed', () => {
    expectHomes(homes)
  })
  test('O18 tapping a card expands it to every Exercise with its Sets as 80 x 8 and BW x 8, and tapping again collapses it', () => {
    expectHomes(homes)
  })
  test('O18 expanding one card leaves the other Session card collapsed', () => {
    expectHomes(homes)
  })
  test('O18 each Exercise in an expanded card has its own Edit that calls onEdit with the Session id and that Exercise id', () => {
    expectHomes(homes)
  })
  test('O18 Open session sits in the expanded card and calls onOpen with the Session id', () => {
    expectHomes(homes)
  })
  test('O18 the exercise group list items stay role presentation so the Session card is the only listitem', () => {
    expectHomes(homes)
  })
  test('O12 an expanded History card shows the Session note and a collapsed one does not', () => {
    expectHomes(homes)
  })
  test('O12 an expanded History card of a Session without a note shows no note element', () => {
    expectHomes(homes)
  })
})

describe('features/history/HistoryFeature.test.tsx retired: its stats live on in the new modules', () => {
  const homes: Array<[string, string]> = [['SessionsScreen', 'SessionsScreen'], ['ProgressFeature', 'ProgressFeature']]
  test('O12 HistoryFeature lists a finished Session and opens its summary', () => {
    expectHomes(homes)
  })
  test('O12 HistoryFeature switches to Stats through the History | Stats switch', () => {
    expectHomes(homes)
  })
  test('O12 a Session written through services.sessions shows in History without a reload', () => {
    expectHomes(homes)
  })
  test('O12 a Session pulled by services.sync.syncNow from FakeSyncServer shows in History without a reload', () => {
    expectHomes(homes)
  })
  test('O13 Edit workout on a History row opens the editor for that Session', () => {
    expectHomes(homes)
  })
  test('O14 Save stores the edited Sets in one write, advances updatedAt and History shows the change', () => {
    expectHomes(homes)
  })
  test('O14 Save stores changed start and end times', () => {
    expectHomes(homes)
  })
  test('O14 Cancel leaves the stored Session unchanged and returns to History', () => {
    expectHomes(homes)
  })
  test('O18 Edit on an Exercise in an expanded History card opens the editor with that Exercise\'s first Set open on the Dials', () => {
    expectHomes(homes)
  })
  test('E12-T1 O4 History does not list a deleted Session', () => {
    expectHomes(homes)
  })
  test('E12-T1 O4 Stats draws no volume bar for a Session that is deleted', () => {
    expectHomes(homes)
  })
  test('O16 Delete workout, confirmed, removes the Session from History, Stats and the records', () => {
    expectHomes(homes)
  })
  test('O16 opening a Session from History shows its duration, volume and the PR it set', () => {
    expectHomes(homes)
  })
  test('O6 Stats counts a Back squat Set as bodyweight reps once Back squat is overridden to Bodyweight', () => {
    expectHomes(homes)
  })
})

describe('features/lifts/LiftsScreen.test.tsx retired: its stats live on in the new modules', () => {
  const homes: Array<[string, string]> = [['ProgressFeature', 'ProgressFeature'], ['AllLifts', 'AllLifts'], ['LiftPage', 'LiftPageView']]
  test('the search field counts every exercise it can find', () => {
    expectHomes(homes)
  })
  test('chips list the trainee\'s lifts in program order with the first one chosen', () => {
    expectHomes(homes)
  })
  test('the lift card shows the latest estimated 1RM and its change since the first session in range', () => {
    expectHomes(homes)
  })
  test('the chart marks the sessions that set a record', () => {
    expectHomes(homes)
  })
  test('the range control narrows the chart to the window chosen', () => {
    expectHomes(homes)
  })
  test('a lift not trained in the range says so instead of drawing an empty chart', () => {
    expectHomes(homes)
  })
  test('the Next row says what to lift next once the top of the range is hit', () => {
    expectHomes(homes)
  })
  test('the Next row says to stay at the weight, and how many reps were done, when short of the top', () => {
    expectHomes(homes)
  })
  test('the records table lists heaviest set, best estimated 1RM and most reps in a set with dates', () => {
    expectHomes(homes)
  })
  test('choosing a bodyweight lift charts its reps and tabulates its own records', () => {
    expectHomes(homes)
  })
  test('a lift that has not moved says no change rather than +0', () => {
    expectHomes(homes)
  })
  test('the bodyweight note names the newest session with bodyweight reps', () => {
    expectHomes(homes)
  })
  test('the volume per session chart stays one tap away', () => {
    expectHomes(homes)
  })
  test('searching lists matching exercises and opens the one tapped', () => {
    expectHomes(homes)
  })
  test('a search with no match says so', () => {
    expectHomes(homes)
  })
  test('with nothing logged it says what fills the tab', () => {
    expectHomes(homes)
  })
  test('loads the logged sessions through services and opens a searched exercise\'s detail', () => {
    expectHomes(homes)
  })
})
