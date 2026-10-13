// [O12] The three styled native controls every screen renders its toggles, radio groups and
// selects through: `.switch`, `.segmented` and `.select`. Red stub (E17-T8): each renders
// nothing until implemented.
import type React from 'react'

export function Switch(_props: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}): JSX.Element | null {
  return null
}

export function Segmented<T extends string>(_props: {
  name: string
  value: T
  options: { value: T; label: string }[]
  onChange: (next: T) => void
  label: string
}): JSX.Element | null {
  return null
}

export function Select(_props: React.SelectHTMLAttributes<HTMLSelectElement>): JSX.Element | null {
  return null
}
