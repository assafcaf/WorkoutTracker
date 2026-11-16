import { useState } from 'react'
import { HEALTH_SETUP_URL, markHealthReady, readHealthReady } from './healthShortcut'
import { HealthSetup } from './HealthSetup'

/**
 * Settings' Apple Health block (V2-10, moved here from the Session summary): the Shortcut setup
 * guide, its "Done, it's set up" mark, and a link to the full setup doc. The summary's Share…
 * sheet keeps only "Send to Apple Health".
 */
export function AppleHealthSettings(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(readHealthReady)
  return (
    <section className="settings-group" aria-label="Apple Health">
      <h2 className="settings-legend">Apple Health</h2>
      <div className="settings-card settings-health">
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
    </section>
  )
}
