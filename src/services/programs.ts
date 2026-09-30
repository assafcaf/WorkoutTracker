import type { Program, UserProgram } from '../types'
import type { ServiceDeps } from './deps'
import { ServiceError, callStorage } from './errors'
import { loadCatalog, loadPrograms } from '../data/catalog'
import { mergePrograms, visiblePrograms } from '../domain/programs'
import {
  ACTIVE_PROGRAM_ID_KEY,
  deleteProgram,
  getUserPrograms,
  readRow,
  resetProgram,
  saveUserProgram,
  setActiveProgramId,
} from '../storage/settingsStore'
import { allSessions, getActiveSession, isLive } from '../storage/sessionStore'

/** Shown, and thrown as a `ServiceError('in-progress', ...)`, when a write would strand the
 * Session in progress (E9-T10's guard, moved here for E11-T5). */
export const IN_PROGRESS_MESSAGE = 'Finish the workout in progress first'

export type ProgramsLoad = {
  programs: Program[]
  userPrograms: UserProgram[]
  activeProgramId: string | null
  staleActiveProgramNotice: boolean
}

export type ProgramService = {
  load(): Promise<ProgramsLoad>
  setActive(id: string): Promise<void>
  save(program: UserProgram): Promise<void>
  remove(id: string): Promise<void>
  reset(id: string): Promise<void>
}

/**
 * The one service the UI loads, switches, saves, deletes and resets Programs through: it owns
 * the active-program fallback (E9-T2's `getActiveProgramId`) and the in-progress guard (E9-T10)
 * that `App.tsx` used to hold.
 */
export function createProgramService(deps: ServiceDeps): ProgramService {
  async function resolveActiveProgramId(
    programs: Program[],
  ): Promise<{ activeProgramId: string | null; staleActiveProgramNotice: boolean }> {
    const row = await readRow(ACTIVE_PROGRAM_ID_KEY)
    const stored = typeof row?.value === 'string' ? row.value : undefined
    if (stored !== undefined) {
      const offered = programs.some((program) => program.id === stored)
      return {
        activeProgramId: offered ? stored : programs[0].id,
        staleActiveProgramNotice: !offered,
      }
    }

    const sessions = (await allSessions()).filter(isLive)
    const latest = sessions.reduce<(typeof sessions)[number] | null>(
      (best, session) => (best === null || session.startedAt > best.startedAt ? session : best),
      null,
    )
    if (!latest) return { activeProgramId: null, staleActiveProgramNotice: false }

    const adopted = programs.some((program) => program.id === latest.programId)
      ? latest.programId
      : programs[0].id
    await setActiveProgramId(adopted, deps.now())
    return { activeProgramId: adopted, staleActiveProgramNotice: false }
  }

  async function guardInProgress(
    check: (session: NonNullable<Awaited<ReturnType<typeof getActiveSession>>>) => boolean,
  ): Promise<void> {
    const active = await getActiveSession()
    if (active && check(active)) {
      throw new ServiceError('in-progress', IN_PROGRESS_MESSAGE)
    }
  }

  return {
    async load() {
      const catalog = loadCatalog()
      const bundled = loadPrograms(catalog)
      return callStorage(
        deps,
        async () => {
          const userPrograms = await getUserPrograms()
          const programs = mergePrograms(bundled, userPrograms)
          const { activeProgramId, staleActiveProgramNotice } = await resolveActiveProgramId(programs)
          return { programs, userPrograms, activeProgramId, staleActiveProgramNotice }
        },
        'Could not load Programs',
      )
    },

    async setActive(id) {
      return callStorage(
        deps,
        async () => {
          await setActiveProgramId(id, deps.now())
          deps.bus.emit('programs')
        },
        'Could not switch Programs',
      )
    },

    async save(program) {
      return callStorage(
        deps,
        async () => {
          await guardInProgress(
            (active) =>
              active.programId === program.id &&
              program.workouts.some((workout) => workout.id === active.workoutId && workout.hidden),
          )
          await saveUserProgram(program, deps.now())
          deps.bus.emit('programs')
        },
        'Could not save the Program',
      )
    },

    async remove(id) {
      return callStorage(
        deps,
        async () => {
          await guardInProgress((active) => active.programId === id)
          const userPrograms = await getUserPrograms()
          if (userPrograms.some((program) => program.id === id)) {
            await deleteProgram(id, deps.now())
          } else {
            // A bundled Program has no stored row yet: hide it by saving one (E9-T10's delete,
            // moved here). `deleteProgram` only marks an existing row hidden.
            const bundled = loadPrograms(loadCatalog()).find((program) => program.id === id)
            if (bundled) {
              await saveUserProgram({ ...bundled, hidden: true, createdAt: deps.now() }, deps.now())
            }
          }
          // A deleted active Program hands over to the first visible one, stored, so a relaunch
          // does not bring it back (E9-T10 O10, as App.tsx did before E11-T15).
          const active = await readRow(ACTIVE_PROGRAM_ID_KEY)
          if (active?.value === id) {
            const bundled = loadPrograms(loadCatalog())
            const fallback = visiblePrograms(mergePrograms(bundled, await getUserPrograms()))[0]
            if (fallback) await setActiveProgramId(fallback.id, deps.now())
          }
          deps.bus.emit('programs')
        },
        'Could not delete the Program',
      )
    },

    async reset(id) {
      return callStorage(
        deps,
        async () => {
          await resetProgram(id, deps.now())
          deps.bus.emit('programs')
        },
        'Could not reset the Program',
      )
    },
  }
}
