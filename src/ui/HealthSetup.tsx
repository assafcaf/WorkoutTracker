import { useState } from 'react'
import { HEALTH_SHORTCUT_NAME, HEALTH_SHORTCUT_STEPS } from './healthShortcut'
import './HealthSetup.css'

interface HealthSetupProps {
  open: boolean
  ready: boolean
  onToggle: () => void
  onReady: () => void
}

/** The Shortcut setup guide: a toggle, a hint while unconfirmed, and the steps inline. */
export function HealthSetup({ open, ready, onToggle, onReady }: HealthSetupProps) {
  const [showName, setShowName] = useState(false)

  function copyName(): void {
    const write = typeof navigator === 'undefined' ? undefined : navigator.clipboard?.writeText
    if (write === undefined) {
      setShowName(true)
      return
    }
    void Promise.resolve(navigator.clipboard.writeText(HEALTH_SHORTCUT_NAME)).catch(() => setShowName(true))
  }

  return (
    <div className="health-setup">
      <button type="button" className="btn-secondary" aria-expanded={open} onClick={onToggle}>
        Set up Apple Health
      </button>
      {ready ? null : (
        <p className="health-setup-hint">If iOS says it can't find the shortcut, set it up first.</p>
      )}
      {open ? (
        <div className="health-setup-guide">
          <ol className="health-setup-steps" aria-label="Apple Health setup steps">
            {HEALTH_SHORTCUT_STEPS.map((step) => (
              <li key={step.key}>{step.text}</li>
            ))}
          </ol>
          <div className="health-setup-name">
            <button type="button" className="btn-secondary" onClick={copyName}>
              Copy name
            </button>
            {showName ? (
              <input
                className="health-setup-name-field"
                aria-label="Shortcut name"
                readOnly
                value={HEALTH_SHORTCUT_NAME}
                onFocus={(e) => e.currentTarget.select()}
              />
            ) : null}
          </div>
          {ready ? null : (
            <button type="button" className="btn-primary" onClick={onReady}>
              Done, it's set up
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
