// The closed stroked icon set. Path data derived from Lucide (https://lucide.dev), ISC licence:
// Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT),
// and by Lucide Contributors 2022. Permission to use, copy, modify, and/or distribute this
// software for any purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.
import type { ReactNode } from 'react'

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
  | 'Search'
  | 'ArrowUp'
  | 'ArrowRight'

const DRAWINGS: Record<IconName, ReactNode> = {
  ChevronDown: <path d="m6 9 6 6 6-6" />,
  ChevronLeft: <path d="m15 18-6-6 6-6" />,
  ChevronRight: <path d="m9 18 6-6-6-6" />,
  Check: <path d="M20 6 9 17l-5-5" />,
  X: <path d="M18 6 6 18M6 6l12 12" />,
  Plus: <path d="M5 12h14M12 5v14" />,
  Minus: <path d="M5 12h14" />,
  Trash: (
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
  ),
  Pencil: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  Clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  Info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  History: <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2" />,
  Swap: <path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />,
  Settings: (
    <>
      <path d="M20 7h-9M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </>
  ),
  Cloud: <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />,
  CloudOff: (
    <path d="m2 2 20 20M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07" />
  ),
  Dumbbell: <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />,
  ChartLine: <path d="M3 3v16a2 2 0 0 0 2 2h16M19 9l-5 5-4-4-3 3" />,
  ListChecks: <path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8" />,
  Search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  ArrowUp: <path d="m5 12 7-7 7 7M12 19V5" />,
  ArrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DRAWINGS[name]}
    </svg>
  )
}
