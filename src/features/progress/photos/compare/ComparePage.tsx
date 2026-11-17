import type { ProgressPageProps } from '../../pages'

export type ComparePageProps = ProgressPageProps<'compare'> & { undoMs?: number }

/** STUB (E26-T8): the Compare page. */
export function ComparePage(props: ComparePageProps): JSX.Element | null {
  void props
  return null
}
