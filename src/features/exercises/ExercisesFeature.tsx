import { useState } from 'react'
import type { Muscle } from '../../types'
import { MUSCLES } from '../../data/library'
import { uuid } from '../../domain/programs'
import { matchesQuery } from '../../domain/search'
import { CustomExerciseForm, type CustomExerciseValues } from '../../ui/CustomExerciseForm'
import { LibraryList } from '../../ui/LibraryList'
import { Select } from '../../ui/controls'
import { Icon } from '../../ui/icons'
import type { AppRoute } from '../routes'
import { DetailOverlay } from '../overlays/DetailOverlay'
import { useServices } from '../ServicesProvider'
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

  // The form writes through the catalog service, which emits 'preferences', so the catalog is
  // read again with the new or renamed custom Exercise in it (E19-T11).
  const services = useServices()
  const [form, setForm] = useState<{ editing: string | null } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const catalogData = useServiceData((s) => s.catalog.load(), ['preferences'])
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

  const bundledEquipment = equipmentOptions.filter((option) => option !== 'none')

  async function saveCustom(values: CustomExerciseValues): Promise<void> {
    const editing = form?.editing ?? null
    try {
      await services.catalog.saveCustomExercise({
        ...values,
        id: editing ?? 'custom-' + uuid(),
        createdAt: Date.now(),
      })
      setFormError(null)
      setForm(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Couldn’t save — try again')
    }
  }

  function editingValues(): CustomExerciseValues | undefined {
    if (form === null || form.editing === null) return undefined
    const entry = library.find((candidate) => candidate.id === form.editing)
    const exercise = catalog.get(form.editing)
    if (!entry || !exercise) return undefined
    return {
      name: entry.name,
      primaryMuscles: entry.primaryMuscles,
      secondaryMuscles: entry.secondaryMuscles,
      equipment: entry.equipment,
      bodyweight: exercise.bodyweight,
      weightStep: exercise.weightStep,
    }
  }

  const filteredLibrary = library.filter((exercise) => {
    const matchesSearch = matchesQuery(exercise.name, search)
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
      <label className="library-search-field">
        <Icon name="Search" size={18} />
        <input
          type="search"
          aria-label="Search exercises"
          placeholder="Search exercises"
          className="library-search"
          value={search}
          onChange={(event) => setFilter({ search: event.target.value })}
        />
      </label>
      <div className="library-filters">
        <Select
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
        </Select>
        <Select
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
        </Select>
      </div>
      <LibraryList
        library={filteredLibrary}
        onOpen={setOpenLibraryId}
        gymEquipment={gymEquipment.data}
        initialMuscles={initialMuscles ?? undefined}
        onNew={() => {
          setFormError(null)
          setForm({ editing: null })
        }}
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
          onEdit={
            openLibraryId.startsWith('custom-')
              ? (id) => {
                  setFormError(null)
                  setForm({ editing: id })
                }
              : undefined
          }
        />
      )}
      {form === null ? null : (
        <CustomExerciseForm
          key={form.editing ?? 'new'}
          initial={editingValues()}
          equipmentOptions={bundledEquipment}
          error={formError}
          onSave={(values) => void saveCustom(values)}
          onCancel={() => setForm(null)}
        />
      )}
    </>
  )
}
