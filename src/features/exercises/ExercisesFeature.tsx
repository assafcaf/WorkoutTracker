import { useState } from 'react'
import type { Muscle } from '../../types'
import { MUSCLES } from '../../data/library'
import { LibraryList } from '../../ui/LibraryList'
import type { AppRoute } from '../routes'
import { DetailOverlay } from '../overlays/DetailOverlay'
import { useServiceData } from '../useServiceData'

/** The Exercises tab's search text and its muscle and equipment filters; `''` means none. */
export type LibraryFilters = { search: string; muscle: string; equipment: string }

const NO_LIBRARY_FILTERS: LibraryFilters = { search: '', muscle: '', equipment: '' }

export type ExercisesFeatureProps = {
  /**
   * The muscles a region panel's "Browse exercises" opened the tab on (E5-T20, M9), or `null`
   * when it was reached any other way -- the same shape `App.tsx`'s `libraryInitialMuscles` was.
   */
  initialMuscles: Muscle[] | null
  navigate(to: AppRoute): void
  /**
   * The search and filters, when the app keeps them across visits to the tab (as `App.tsx` always
   * has); omitted, the tab keeps its own for as long as it is mounted.
   */
  filters?: LibraryFilters
  onFiltersChange?(filters: LibraryFilters): void
}

/**
 * The Exercises tab as its own container over services (E11-T12): search, filter and open an
 * exercise's detail, as today (formerly `App.tsx`'s `'exercises'` view branch), optionally
 * opened filtered to `initialMuscles`.
 */
export function ExercisesFeature({
  initialMuscles,
  filters: heldFilters,
  onFiltersChange,
}: ExercisesFeatureProps): JSX.Element | null {
  const [ownFilters, setOwnFilters] = useState<LibraryFilters>(NO_LIBRARY_FILTERS)
  const filters = heldFilters ?? ownFilters
  const { search, muscle, equipment } = filters
  function setFilter(change: Partial<LibraryFilters>): void {
    const next = { ...filters, ...change }
    setOwnFilters(next)
    onFiltersChange?.(next)
  }
  const [openLibraryId, setOpenLibraryId] = useState<string | null>(null)

  const catalogData = useServiceData((s) => s.catalog.load(), [])
  const gymEquipment = useServiceData((s) => s.preferences.gymEquipment(), ['preferences'])

  if (catalogData.status !== 'ready' || gymEquipment.status !== 'ready') return null

  const { catalog, library, videos } = catalogData.data

  const equipmentOptions = Array.from(new Set(library.map((exercise) => exercise.equipment)))
    .sort((a, b) => {
      if (a === null) return 1
      if (b === null) return -1
      return a.localeCompare(b)
    })
    .map((option) => option ?? 'none')

  const trimmedSearch = search.trim().toLowerCase()
  const filteredLibrary = library.filter((exercise) => {
    const matchesSearch =
      trimmedSearch === '' || exercise.name.toLowerCase().includes(trimmedSearch)
    const matchesMuscle = muscle === '' || exercise.primaryMuscles.includes(muscle as Muscle)
    const matchesEquipment =
      equipment === ''
        ? true
        : equipment === 'none'
          ? exercise.equipment === null
          : exercise.equipment === equipment

    return matchesSearch && matchesMuscle && matchesEquipment
  })

  return (
    <>
      <div className="library-filters">
        <input
          type="search"
          aria-label="Search exercises"
          placeholder="Search exercises"
          className="library-search"
          value={search}
          onChange={(event) => setFilter({ search: event.target.value })}
        />
        <select
          aria-label="Muscle"
          className="library-filter"
          value={muscle}
          onChange={(event) => setFilter({ muscle: event.target.value })}
        >
          <option value="">All muscles</option>
          {MUSCLES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          aria-label="Equipment"
          className="library-filter"
          value={equipment}
          onChange={(event) => setFilter({ equipment: event.target.value })}
        >
          <option value="">All equipment</option>
          {equipmentOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <LibraryList
        library={filteredLibrary}
        onOpen={setOpenLibraryId}
        gymEquipment={gymEquipment.data}
        initialMuscles={initialMuscles ?? undefined}
      />
      {openLibraryId === null ? null : (
        <DetailOverlay
          libraryId={openLibraryId}
          catalog={catalog}
          library={library}
          videos={videos}
          gymEquipment={gymEquipment.data}
          onBack={() => setOpenLibraryId(null)}
          onOpenDetail={setOpenLibraryId}
        />
      )}
    </>
  )
}
