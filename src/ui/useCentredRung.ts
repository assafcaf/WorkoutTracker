import { useLayoutEffect, useRef } from 'react'

/**
 * A ref for a dial's column that keeps its selected rung centred in the column's window.
 *
 * The column is only three rungs tall, so a value set by minus/plus, the keypad or the preset
 * would otherwise sit out of sight. Only the column's own scroll offset moves — never the page.
 */
export function useCentredRung(value: number | null) {
  const columnRef = useRef<HTMLUListElement>(null)

  useLayoutEffect(() => {
    const column = columnRef.current
    const rung = column?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!column || !rung) return
    column.scrollTop = rung.offsetTop - (column.clientHeight - rung.offsetHeight) / 2
  }, [value])

  return columnRef
}
