import { useEffect, useState } from 'react'
import type { AppRoute } from '../routes'
import { useServiceData } from '../useServiceData'
import { useServices, useSyncControls } from '../ServicesProvider'
import { visiblePrograms } from '../../domain/programs'
import { Settings } from '../../ui/Settings'
import { BackupBadge } from '../../ui/BackupBadge'
import { ImportConfirm } from '../../ui/ImportConfirm'
import { ServiceError, type PendingImport } from '../../services'
import type { PlateInventory, VolumeBaseline } from '../../types'

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
  const trackEffortData = useServiceData((s) => s.preferences.trackEffort(), ['preferences'])
  const [chosenEffort, setChosenEffort] = useState<boolean | null>(null)
  // Dropped once the stored choice reads back as the one made.
  useEffect(() => {
    if (trackEffortData.status !== 'ready') return
    setChosenEffort((chosen) => (chosen === trackEffortData.data ? null : chosen))
  }, [trackEffortData])
  const plateInventoryData = useServiceData((s) => s.preferences.plateInventory(), ['preferences'])
  const [plateError, setPlateError] = useState<string | null>(null)
  const catalogData = useServiceData((s) => s.catalog.load(), [])
  const [savedBaseline, setSavedBaseline] = useState<VolumeBaseline | null>(null)
  // Dropped once the stored baseline reads back as the one chosen.
  useEffect(() => {
    if (volumeBaselineData.status !== 'ready') return
    const stored = JSON.stringify(volumeBaselineData.data)
    setSavedBaseline((chosen) => (JSON.stringify(chosen) === stored ? null : chosen))
  }, [volumeBaselineData])
  const lastExportedAtData = useServiceData(
    (s) => s.preferences.lastExportedAt().catch(() => null),
    ['preferences'],
  )

  const offeredPrograms =
    programsData.status === 'ready' ? visiblePrograms(programsData.data.programs) : []
  const activeProgramId = programsData.status === 'ready' ? programsData.data.activeProgramId : null
  const gymEquipment = gymEquipmentData.status === 'ready' ? gymEquipmentData.data : null
  // The baseline just chosen shows at once, until the reread of the stored one catches up.
  const volumeBaseline =
    savedBaseline ?? (volumeBaselineData.status === 'ready' ? volumeBaselineData.data : undefined)

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

  function handleVolumeBaselineChange(baseline: VolumeBaseline): void {
    setSavedBaseline(baseline)
    services.preferences.setVolumeBaseline(baseline).catch(() => {
      // Not saved: the stored baseline shows again.
      setSavedBaseline(null)
    })
  }

  function handleTrackEffortChange(on: boolean): void {
    setChosenEffort(on)
    services.preferences.setTrackEffort(on).catch(() => {
      setChosenEffort(null)
    })
  }

  function handlePlateInventoryChange(inventory: PlateInventory): void {
    setPlateError(null)
    services.preferences.setPlateInventory(inventory).catch((error: unknown) => {
      // Refused: the stored inventory stays, and shows again.
      setPlateError(error instanceof Error ? error.message : 'the plates could not be saved')
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
        trackEffort={chosenEffort ?? (trackEffortData.status === 'ready' ? trackEffortData.data : false)}
        onTrackEffortChange={handleTrackEffortChange}
        plateInventory={plateInventoryData.status === 'ready' ? plateInventoryData.data : undefined}
        onPlateInventoryChange={handlePlateInventoryChange}
        plateInventoryError={plateError}
        sync={syncControls.sync}
        onSyncNow={() => {
          void syncControls.syncNow()
        }}
        onAdoptAccount={() => {
          void syncControls.adoptAccount()
        }}
      />
      {lastExportedAtData.status === 'ready' ? (
        <BackupBadge lastExportedAt={lastExportedAtData.data} now={Date.now()} />
      ) : null}
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
