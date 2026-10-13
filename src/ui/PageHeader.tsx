import type { ReactNode } from 'react'
import './PageHeader.css'

export type PageHeaderProps = {
  title: string
  /** The small muted line under the title, e.g. "Tue 13 Oct · Synced 2 min ago". */
  subtitle?: ReactNode
  /** Right-aligned icon buttons beside the title. */
  actions?: ReactNode
  /** Extra classes for the header element itself, e.g. the shell's own `app-header`. */
  className?: string
}

/**
 * A tab's large screen title (Progress Dashboard S1, S6a, S6b): the title, a small muted
 * subtitle under it, and the screen's icon buttons right-aligned on the title's baseline.
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps): JSX.Element {
  return (
    <header className={className ? `page-header ${className}` : 'page-header'}>
      <div className="page-header-text">
        <h1 className="page-header-title">{title}</h1>
        {subtitle ? <div className="page-header-subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  )
}
