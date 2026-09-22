import { useEffect, useState } from 'react'
import type { Exercise, Program } from './types'
import { loadCatalog, loadPrograms } from './data/catalog'
import { db, isStorageAvailable } from './storage/db'
import { ACTIVE_PROGRAM_ID_KEY, getActiveProgramId, setActiveProgramId } from './storage/settingsStore'
import { ProgramPicker } from './ui/ProgramPicker'
import { Settings } from './ui/Settings'
import { StorageUnavailableBanner } from './ui/StorageUnavailableBanner'

type View = 'picker' | 'settings'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      catalog: Map<string, Exercise>
      programs: Program[]
      storageAvailable: boolean
      activeProgramId: string
      staleActiveProgramNotice: boolean
    }

/**
 * The whole app: loads the catalog and programs, resolves the active program, and renders the
 * picker or a route to Settings — or a hard-error screen when the programs fail to load.
 *
 * E1-T7 and E1-T8 extend this routing with the exercise list and the history list rather than
 * replacing it.
 */
export function App(): JSX.Element {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [view, setView] = useState<View>('picker')

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        const catalog = loadCatalog()
        const programs = loadPrograms(catalog)
        const storageAvailable = await isStorageAvailable()
        const storedRow = await db.settings.get(ACTIVE_PROGRAM_ID_KEY)
        const storedProgramId = typeof storedRow?.value === 'string' ? storedRow.value : undefined
        const activeProgramId = await getActiveProgramId(programs)
        const staleActiveProgramNotice =
          storedProgramId !== undefined &&
          !programs.some((program) => program.id === storedProgramId)

        if (cancelled) return
        setState({
          status: 'ready',
          catalog,
          programs,
          storageAvailable,
          activeProgramId,
          staleActiveProgramNotice,
        })
      } catch (error) {
        if (cancelled) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') return <div />

  if (state.status === 'error') {
    return <div role="alert">Could not load the workout programs: {state.message}</div>
  }

  const { catalog, programs, storageAvailable, activeProgramId, staleActiveProgramNotice } = state

  function handleActiveProgramChange(id: string): void {
    setActiveProgramId(id)
      .then(() => {
        setState((current) =>
          current.status === 'ready'
            ? { ...current, activeProgramId: id, staleActiveProgramNotice: false }
            : current,
        )
      })
      .catch(() => {
        // Nothing to recover to here; a later read will surface the same failure.
      })
  }

  if (view === 'settings') {
    return (
      <div>
        <button type="button" onClick={() => setView('picker')}>
          Back
        </button>
        <Settings
          programs={programs}
          activeProgramId={activeProgramId}
          onActiveProgramChange={handleActiveProgramChange}
        />
      </div>
    )
  }

  return (
    <div>
      {!storageAvailable ? <StorageUnavailableBanner /> : null}
      {staleActiveProgramNotice ? (
        <p>The saved active program no longer exists; showing the first program instead.</p>
      ) : null}
      <button type="button" onClick={() => setView('settings')}>
        Settings
      </button>
      <fieldset disabled={!storageAvailable}>
        <ProgramPicker
          programs={programs}
          catalog={catalog}
          activeProgramId={activeProgramId}
          onChoose={() => {
            // Starting or resuming a session from here is E1-T7's job.
          }}
        />
      </fieldset>
    </div>
  )
}
