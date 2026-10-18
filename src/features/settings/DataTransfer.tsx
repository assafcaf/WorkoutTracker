import { useState } from 'react'
import { uuid } from '../../domain/programs'
import { ServiceError, type PendingTransfer } from '../../services'
import { Icon } from '../../ui/icons'
import { ImportReview } from '../../ui/ImportReview'
import type { CustomExerciseValues } from '../../ui/CustomExerciseForm'
import { useServices } from '../ServicesProvider'
import { useServiceData } from '../useServiceData'
import './DataTransfer.css'

/** Reads a chosen file's text; `File.text()` is missing in some environments. */
function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Settings' "Your data" (E23-T9, O19-O21): the sets CSV, and the Strong or Hevy import with its
 * review. The result and any refusal show inline in a status line, never a dialog.
 */
export function DataTransfer(): JSX.Element {
  const services = useServices()
  const catalogData = useServiceData((s) => s.catalog.load(), ['preferences'])
  const [text, setText] = useState('')
  const [pending, setPending] = useState<PendingTransfer | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const catalogReady = catalogData.status === 'ready' ? catalogData.data : null
  const library = catalogReady?.library ?? []
  const equipmentOptions = Array.from(
    new Set(library.map((e) => e.equipment).filter((e): e is string => e !== null)),
  ).sort((a, b) => a.localeCompare(b))

  function exerciseName(id: string): string {
    return catalogReady?.catalog.get(id)?.name ?? library.find((e) => e.id === id)?.name ?? id
  }

  function handleExport(): void {
    setResult(null)
    setProblem(null)
    services.transfer.exportCsv().catch((error: unknown) => {
      setProblem(error instanceof Error ? error.message : 'the sets could not be exported')
    })
  }

  async function handleFile(file: File): Promise<void> {
    setResult(null)
    setProblem(null)
    try {
      const content = await readText(file)
      const read = await services.transfer.readImport(content)
      setText(content)
      setPending(read)
    } catch (error) {
      setPending(null)
      setProblem(error instanceof ServiceError ? error.message : 'the file could not be read')
    }
  }

  async function createCustom(values: CustomExerciseValues): Promise<{ id: string } | { error: string }> {
    const id = 'custom-' + uuid()
    try {
      await services.catalog.saveCustomExercise({ ...values, id, createdAt: Date.now() })
      return { id }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Couldn’t save — try again' }
    }
  }

  async function runImport(choices: Record<string, string | null>, unit: 'kg' | 'lbs'): Promise<void> {
    if (!pending) return
    try {
      const ready = !pending.unitStated && unit === 'lbs' ? await services.transfer.readImport(text, unit) : pending
      const done = await services.transfer.confirmImport(ready, choices)
      setPending(null)
      setResult(
        `Added ${plural(done.added, 'Session', 'Sessions')} · ${done.skipped} already here, skipped · ` +
          plural(done.leftOut, 'row', 'rows') +
          ' left out',
      )
    } catch (error) {
      setPending(null)
      setProblem(error instanceof Error ? error.message : 'the history could not be imported')
    }
  }

  return (
    <section className="settings-group data-transfer" aria-label="Your data">
      <h2 className="settings-legend">Your data</h2>
      <div className="settings-card card">
        <button type="button" className="settings-action btn-quiet" onClick={handleExport}>
          <span className="settings-action-label">Export sets (CSV)</span>
          <Icon name="ChevronRight" size={18} />
        </button>
        <label className="settings-action">
          <span className="settings-action-label">Import from Strong or Hevy</span>
          <Icon name="ChevronRight" size={18} />
          <input
            className="data-transfer-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void handleFile(file)
            }}
          />
        </label>
      </div>
      {result ? (
        <p className="data-transfer-result" role="status">
          {result}
        </p>
      ) : null}
      {problem ? (
        <p className="data-transfer-problem" role="alert">
          {problem}
        </p>
      ) : null}
      {pending ? (
        <ImportReview
          names={pending.names.map(({ source, proposal }) => ({ source, proposal }))}
          sessionCount={pending.sessionCount}
          unitStated={pending.unitStated}
          library={library}
          exerciseName={exerciseName}
          equipmentOptions={equipmentOptions}
          createCustom={createCustom}
          onImport={(choices, unit) => void runImport(choices, unit)}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </section>
  )
}
