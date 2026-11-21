import { useState } from 'react'
import { HEALTH_SETUP_URL, markHealthReady, readHealthReady } from './healthShortcut'
import { HealthSetup } from './HealthSetup'
import { Icon } from './icons'
import { SettingsPage } from './SettingsPage'

/**
 * Settings' Apple Health row (V2-10, DX-23): one row "Apple Health ›" that pushes its page -- the
 * Shortcut setup guide, its "Done, it's set up" mark, and the how-to. The summary's Share… sheet
 * keeps only "Send to Apple Health".
 */
export function AppleHealthSettings(): JSX.Element {
  const [page, setPage] = useState(false)
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(readHealthReady)
  return (
    <section className="settings-group" aria-label="Apple Health">
      <div className="settings-card">
        <button
          type="button"
          className="settings-action btn-quiet"
          aria-haspopup="dialog"
          onClick={() => setPage(true)}
        >
          <span className="settings-action-label">Apple Health</span>
          {ready ? <span className="settings-action-value">Set up</span> : null}
          <Icon name="ChevronRight" size={18} />
        </button>
      </div>
      {page ? (
        <SettingsPage title="Apple Health" onBack={() => setPage(false)}>
          <div className="settings-health">
            <HealthSetup
              open={open}
              ready={ready}
              onToggle={() => setOpen((o) => !o)}
              onReady={() => {
                markHealthReady()
                setReady(true)
              }}
            />
            <p className="settings-health-help">
              <a href={HEALTH_SETUP_URL} target="_blank" rel="noreferrer">
                How to set it up
              </a>
            </p>
          </div>
        </SettingsPage>
      ) : null}
    </section>
  )
}
