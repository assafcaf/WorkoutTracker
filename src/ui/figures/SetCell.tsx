import { createElement } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../icons'
import { PrTag } from './PrTag'
import './figures.css'

/** The four states of a set cell (study §3, "The one set row"). */
export type SetCellState = 'planned' | 'current' | 'done' | 'pr'

/**
 * SetCell -- the one set cell, `[index or W] [mark]` over its figure, in four states:
 *
 *   planned   dashed control border, ink-3 figure            (a Set still to come)
 *   current   2 px live border, ink figure                    (the Set on the steppers)
 *   done      surface fill, hairline, ink figure, ✓ in ink-3  (a logged Set)
 *   pr        done, plus the gold PrTag in place of the ✓      (a logged Set that is a real PR)
 *
 * Props:
 *   - `state`: one of the four above; drawn from `data-state`, so a site's own CSS keeps only
 *     layout (size, padding, how the figure wraps).
 *   - `index`: the cell's label (`1`, `W`, a kind letter), in the head before the mark; plain
 *     text, or wrapped in a `setcell-index` span when it is markup (a number and its kind).
 *   - `mark`: the head's corner mark. Left out, it is the state's own (✓ when done, PR when pr,
 *     none otherwise); `null` draws none (a cell showing its reps left there instead).
 *   - `headClassName`: the head's class (default `set-cell-head`), for a site's layout.
 *   - `className`: the site's layout classes, added to `setcell`.
 *   - `onClick`: makes the cell a button element (role `cell`); without it the cell is `as`
 *     (`div` by default, or `span`).
 *   - `children`: the figure, usually a `SetFigure`.
 *   - `aria-label`, `aria-hidden` and any `data-*` attribute pass through.
 */
export type SetCellProps = {
  state: SetCellState
  index?: ReactNode
  mark?: ReactNode
  headClassName?: string
  className?: string
  onClick?: () => void
  as?: 'div' | 'span'
  children: ReactNode
  'aria-label'?: string
  'aria-hidden'?: boolean | 'true' | 'false'
  [data: `data-${string}`]: string | undefined
}

export function SetCell({
  state,
  index,
  mark,
  headClassName = 'set-cell-head',
  className,
  onClick,
  as = 'div',
  children,
  ...rest
}: SetCellProps): JSX.Element {
  const interactive = onClick !== undefined
  // A button cell wears the `cell` control role (src/styles/components.css) like every
  // button-cell before it; a static one does not need it.
  const classes = ['setcell', interactive && !(className ?? '').split(' ').includes('cell') ? 'cell' : '', className ?? '']
    .filter((name) => name !== '')
    .join(' ')
  const shownMark =
    mark !== undefined ? mark : state === 'pr' ? <PrTag label={null} /> : state === 'done' ? <Icon name="Check" size={12} /> : null
  return createElement(
    interactive ? 'button' : as,
    {
      ...rest,
      ...(interactive ? { type: 'button', onClick } : {}),
      className: classes,
      'data-state': state,
    },
    <span className={headClassName}>
      {index === undefined || index === null ? null : typeof index === 'string' || typeof index === 'number' ? (
        index
      ) : (
        <span className="setcell-index">{index}</span>
      )}
      {shownMark}
    </span>,
    children,
  )
}
