import { useEffect, useId } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './icons'

export type SettingsPageProps = {
  /** The page's name, its heading and its dialog's name: "Bar and plates", "Apple Health". */
  title: string
  onBack(): void
  children: ReactNode
}

/**
 * A Settings page pushed over the list (DX-23, DX-06): a bare ‹ and its title in a bar, then its
 * rows on the same 16 px gutter as every page; the tab bar stays under it, like every pushed
 * page. Escape goes back too.
 */
export function SettingsPage({ title, onBack, children }: SettingsPageProps): JSX.Element {
  const headingId = useId()
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])
  return (
    <div role="dialog" aria-labelledby={headingId} className="settings-page overlay-panel overlay-panel--pushed">
      <div className="settings-page-bar">
        <button type="button" className="settings-page-back icon-btn" aria-label="Back" onClick={onBack}>
          <Icon name="ChevronLeft" size={24} />
        </button>
        <h2 id={headingId} className="settings-page-title">
          {title}
        </h2>
        <span aria-hidden="true" />
      </div>
      <div className="settings settings-page-body">{children}</div>
    </div>
  )
}
