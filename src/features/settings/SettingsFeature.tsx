import { useEffect, useState } from 'react'
import type { AppRoute } from '../routes'
import { useServiceData } from '../useServiceData'
import { useServices, useSyncControls } from '../ServicesProvider'
import { Settings } from '../../ui/Settings'
import { BackupBadge, isBackupDue } from '../../ui/BackupBadge'
import { ImportConfirm } from '../../ui/ImportConfirm'
import { ServiceError, type PendingImport } from '../../services'
import type { PushTestOutcome } from '../../services/push'
import type { NotificationStatus } from '../../ui/NotificationSettings'
import type { Reminders } from '../../contract'
import type { PlateInventory } from '../../types'
import { DataTransfer } from './DataTransfer'

export type SettingsFeatureProps = {
  navigate(to: AppRoute): void
  onInSession(inSession: boolean): void
}

/**
 * The Settings tab as its own container over services (E11-T14): saves the Workout settings and
 * the reminders, exports, imports with confirmation, and shows the sync status and "Sync now"
 * from `useSyncControls()`. Since V2-09 the active Program is chosen on the Program tab, the
 * gym's equipment on Program > Exercises, and "Compare volume with" is no longer offered (its
 * stored value still applies).
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

  const trackEffortData = useServiceData((s) => s.preferences.trackEffort(), ['preferences'])
  const [chosenEffort, setChosenEffort] = useState<boolean | null>(null)
  // Dropped once the stored choice reads back as the one made.
  useEffect(() => {
    if (trackEffortData.status !== 'ready') return
    setChosenEffort((chosen) => (chosen === trackEffortData.data ? null : chosen))
  }, [trackEffortData])
  const weekStartData = useServiceData((s) => s.preferences.weekStart(), ['preferences'])
  const [chosenWeekStart, setChosenWeekStart] = useState<number | null>(null)
  // Dropped once the stored choice reads back as the one made.
  useEffect(() => {
    if (weekStartData.status !== 'ready') return
    setChosenWeekStart((chosen) => (chosen === weekStartData.data ? null : chosen))
  }, [weekStartData])
  const keepScreenOnData = useServiceData((s) => s.preferences.keepScreenOnDuringRest(), ['preferences'])
  const [chosenKeepScreenOn, setChosenKeepScreenOn] = useState<boolean | null>(null)
  useEffect(() => {
    if (keepScreenOnData.status !== 'ready') return
    setChosenKeepScreenOn((chosen) => (chosen === keepScreenOnData.data ? null : chosen))
  }, [keepScreenOnData])
  const plateInventoryData = useServiceData((s) => s.preferences.plateInventory(), ['preferences'])
  const [plateError, setPlateError] = useState<string | null>(null)
  const [pushStatus, setPushStatus] = useState<NotificationStatus | null>(null)
  const [pushFailed, setPushFailed] = useState(false)
  const [testResult, setTestResult] = useState<PushTestOutcome | null>(null)
  useEffect(() => {
    let live = true
    Promise.resolve()
      .then(() => services.push.status())
      .then((status) => {
        if (live) setPushStatus(status)
      })
      .catch(() => {
        if (live) setPushStatus('unsupported')
      })
    return () => {
      live = false
    }
  }, [services])
  const remindersData = useServiceData(async (s) => s.push.reminders(), ['preferences'])
  const lastExportedAtData = useServiceData(
    (s) => s.preferences.lastExportedAt().catch(() => null),
    ['preferences'],
  )
  // V1-30: with no Session logged there is nothing to back up yet, so no reminder.
  const hasSessionsData = useServiceData(
    (s) =>
      s.sessions
        .list()
        .then((list) => list.length > 0)
        .catch(() => true),
    ['sessions'],
  )

  function handleTrackEffortChange(on: boolean): void {
    setChosenEffort(on)
    services.preferences.setTrackEffort(on).catch(() => {
      setChosenEffort(null)
    })
  }

  function handleWeekStartChange(day: number): void {
    setChosenWeekStart(day)
    services.preferences.setWeekStart(day).catch(() => {
      setChosenWeekStart(null)
    })
  }

  function handleKeepScreenOnChange(on: boolean): void {
    setChosenKeepScreenOn(on)
    services.preferences.setKeepScreenOnDuringRest(on).catch(() => {
      setChosenKeepScreenOn(null)
    })
  }

  function handlePlateInventoryChange(inventory: PlateInventory): void {
    setPlateError(null)
    services.preferences.setPlateInventory(inventory).catch((error: unknown) => {
      // Refused: the stored inventory stays, and shows again.
      setPlateError(error instanceof Error ? error.message : 'the plates could not be saved')
    })
  }

  function handleEnableNotifications(): void {
    setPushFailed(false)
    services.push
      .enable()
      .then((result) => {
        if (result === 'failed') setPushFailed(true)
        else setPushStatus(result)
      })
      .catch(() => setPushFailed(true))
  }

  function handleDisableNotifications(): void {
    services.push
      .disable()
      .then(setPushStatus)
      .catch(() => {
        // Still subscribed; the section keeps showing Turn off.
      })
  }

  function handleTestNotification(): void {
    services.push
      .test()
      .then(setTestResult)
      .catch(() => setTestResult({ error: 'failed' }))
  }

  function handleRemindersChange(value: Reminders | null): void {
    services.push.setReminders(value).catch(() => {
      // Not saved: the stored reminders show again.
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
        onExport={handleExport}
        onImportFile={handleImportFile}
        lastExportedAt={lastExportedAtData.status === 'ready' ? lastExportedAtData.data : undefined}
        dataExtras={
          <>
            {lastExportedAtData.status === 'ready' &&
            hasSessionsData.status === 'ready' &&
            isBackupDue(lastExportedAtData.data, Date.now(), hasSessionsData.data) ? (
              <BackupBadge lastExportedAt={lastExportedAtData.data} now={Date.now()} />
            ) : null}
            <DataTransfer />
          </>
        }
        trackEffort={chosenEffort ?? (trackEffortData.status === 'ready' ? trackEffortData.data : false)}
        onTrackEffortChange={handleTrackEffortChange}
        plateInventory={plateInventoryData.status === 'ready' ? plateInventoryData.data : undefined}
        onPlateInventoryChange={handlePlateInventoryChange}
        plateInventoryError={plateError}
        weekStart={chosenWeekStart ?? (weekStartData.status === 'ready' ? weekStartData.data : undefined)}
        onWeekStartChange={handleWeekStartChange}
        keepScreenOnDuringRest={
          chosenKeepScreenOn ?? (keepScreenOnData.status === 'ready' ? keepScreenOnData.data : undefined)
        }
        onKeepScreenOnDuringRestChange={handleKeepScreenOnChange}
        notifications={
          pushStatus
            ? {
                status: pushStatus,
                failed: pushFailed,
                onEnable: handleEnableNotifications,
                onDisable: handleDisableNotifications,
                onTest: handleTestNotification,
                testResult,
                reminders: remindersData.status === 'ready' ? remindersData.data : null,
                onRemindersChange: handleRemindersChange,
                weekStart: chosenWeekStart ?? (weekStartData.status === 'ready' ? weekStartData.data : undefined),
              }
            : undefined
        }
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
