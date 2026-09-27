import { useEffect, useState } from 'react'
import type { AppRoute } from '../routes'
import { useServiceData } from '../useServiceData'
import { useServices, useSyncControls } from '../ServicesProvider'
import { visiblePrograms } from '../../domain/programs'
import { Settings } from '../../ui/Settings'
import { ImportConfirm } from '../../ui/ImportConfirm'
import { ServiceError, type PendingImport } from '../../services'

export type SettingsFeatureProps = {
  navigate(to: AppRoute): void
  onInSession(inSession: boolean): void
}

/**
 * The Settings tab as its own container over services (E11-T14): switches the active Program,
 * saves gym equipment and the volume baseline, exports, imports with confirmation, and shows
 * the sync status and "Sync now" from `useSyncControls()` -- all as `App.tsx` did before E11.
 */
export function SettingsFeature(props: SettingsFeatureProps): JSX.Element {
  const { onInSession } = props
  const services = useServices()
  const syncControls = useSyncControls()
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Settings is never inside a session in progress.
  useEffect(() => {
    onInSession(false)
  }, [onInSession])

  const programsData = useServiceData((s) => s.programs.load(), ['programs'])
  const gymEquipmentData = useServiceData((s) => s.preferences.gymEquipment(), ['preferences'])
  const volumeBaselineData = useServiceData((s) => s.preferences.volumeBaseline(), ['preferences'])
  const catalogData = useServiceData((s) => s.catalog.load(), [])

  const offeredPrograms =
    programsData.status === 'ready' ? visiblePrograms(programsData.data.programs) : []
  const activeProgramId = programsData.status === 'ready' ? programsData.data.activeProgramId : null
  const gymEquipment = gymEquipmentData.status === 'ready' ? gymEquipmentData.data : null
  const volumeBaseline = volumeBaselineData.status === 'ready' ? volumeBaselineData.data : undefined

  const equipmentTypes =
    catalogData.status === 'ready'
      ? Array.from(
          new Set(
            catalogData.data.library
              .map((exercise) => exercise.equipment)
              .filter(
                (equipment): equipment is string =>
                  equipment !== null && equipment !== 'body only',
              ),
          ),
        ).sort((a, b) => a.localeCompare(b))
      : []

  function handleActiveProgramChange(id: string): void {
    services.programs.setActive(id).catch(() => {
      // Nothing to recover to here; a later read will surface the same failure.
    })
  }

  function handleGymEquipmentChange(list: string[]): void {
    services.preferences.setGymEquipment(list).catch(() => {
      // Nothing to recover to here; a later read will surface the same failure.
    })
  }

  function handleVolumeBaselineChange(baseline: NonNullable<typeof volumeBaseline>): void {
    services.preferences.setVolumeBaseline(baseline).catch(() => {
      // Nothing to recover to here; a later read will surface the same failure.
    })
  }

  function handleExport(): void {
    setImportError(null)
    services.backup.export().catch(() => {
      // Nothing was written; the settings screen stays up with nothing to undo.
    })
  }

  function handleImportFile(text: string): void {
    services.backup
      .read(text)
      .then((pending) => {
        setImportError(null)
        setPendingImport(pending)
      })
      .catch((error: unknown) => {
        setPendingImport(null)
        setImportError(
          error instanceof ServiceError ? error.message : 'the backup could not be read',
        )
      })
  }

  function handleImportConfirm(): void {
    if (!pendingImport) return
    const pending = pendingImport
    setPendingImport(null)
    services.backup.confirmImport(pending).catch(() => {
      setImportError('the backup could not be imported')
    })
  }

  return (
    <>
      <Settings
        programs={offeredPrograms}
        activeProgramId={activeProgramId}
        onActiveProgramChange={handleActiveProgramChange}
        onExport={handleExport}
        onImportFile={handleImportFile}
        equipmentTypes={equipmentTypes}
        gymEquipment={gymEquipment}
        onGymEquipmentChange={handleGymEquipmentChange}
        volumeBaseline={volumeBaseline}
        onVolumeBaselineChange={handleVolumeBaselineChange}
        sync={syncControls.sync}
        onSyncNow={() => {
          void syncControls.syncNow()
        }}
        onAdoptAccount={() => {
          void syncControls.adoptAccount()
        }}
      />
      {importError ? <div role="alert">{importError}</div> : null}
      {pendingImport ? (
        <ImportConfirm
          currentCount={pendingImport.plan.kept + pendingImport.plan.removed}
          incomingCount={pendingImport.file.sessions.length}
          plan={pendingImport.plan}
          onConfirm={handleImportConfirm}
          onCancel={() => setPendingImport(null)}
        />
      ) : null}
    </>
  )
}
