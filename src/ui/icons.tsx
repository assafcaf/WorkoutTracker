// Stub: E17-T3 replaces this with the Lucide-derived stroked icon set (ISC licence).
export type IconName =
  | 'ChevronDown'
  | 'ChevronLeft'
  | 'ChevronRight'
  | 'Check'
  | 'X'
  | 'Plus'
  | 'Minus'
  | 'Trash'
  | 'Pencil'
  | 'Clock'
  | 'Info'
  | 'History'
  | 'Swap'
  | 'Settings'
  | 'Cloud'
  | 'CloudOff'
  | 'Dumbbell'
  | 'ChartLine'
  | 'ListChecks'

export function Icon({ name, size = 20 }: { name: IconName; size?: number }): JSX.Element {
  void name
  void size
  return <svg />
}
