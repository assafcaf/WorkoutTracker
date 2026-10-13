// [O12] The three styled native controls every screen renders its toggles, radio groups and
// selects through: `.switch`, `.segmented` and `.select` (rules in src/styles/components.css).
// Each stays a native element, so a screen reader, the keyboard and the OS picker all keep
// working; only the paint is ours.
import type React from 'react'
import { Icon } from './icons'

/** A checkbox drawn as a switch, named by the label text that sits before it. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}): JSX.Element {
  return (
    <label className="switch-field">
      <span className="switch-label">{label}</span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

/** A radio group drawn as one row of segments, the checked one raised. */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  label,
}: {
  name: string
  value: T
  options: { value: T; label: string }[]
  onChange: (next: T) => void
  label: string
}): JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className="segmented">
      {options.map((option) => (
        <label key={option.value} className="segmented-option">
          <input
            type="radio"
            className="segmented-input"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span className="segmented-label">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

/**
 * A native select element with the icon set's chevron beside it. A caller's `className` lands on
 * the wrapper, for layout; the select itself is always `.select`.
 */
export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <span className={className ? `select-field ${className}` : 'select-field'}>
      <select {...props} className="select" />
      <Icon name="ChevronDown" size={18} />
    </span>
  )
}
