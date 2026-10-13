// [O12] Switch, Segmented and Select: the styled native controls. A checkbox is a `.switch`
// carrying role="switch" and aria-checked; a radio group is a `.segmented` radiogroup; a select
// is a native `<select className="select">` with the icon set's ChevronDown beside it.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type React from 'react'
import { describe, expect, test, vi } from 'vitest'
import { Segmented, Select, Switch } from './controls'

// The ChevronDown drawing in src/ui/icons.tsx, written out by hand.
const CHEVRON_DOWN_PATH = 'm6 9 6 6 6-6'

describe('[O12] Switch', () => {
  test('O12 a Switch is a checkbox input with role switch and the switch class, named by its label', () => {
    render(<Switch checked={false} onChange={() => {}} label="Track effort" />)

    const control = screen.getByRole('switch', { name: 'Track effort' })
    expect(control.tagName).toBe('INPUT')
    expect(control).toHaveAttribute('type', 'checkbox')
    expect(control).toHaveClass('switch')
  })

  test('O12 a checked Switch reads aria-checked true and is checked', () => {
    render(<Switch checked onChange={() => {}} label="Track effort" />)

    const control = screen.getByRole('switch', { name: 'Track effort' })
    expect(control).toHaveAttribute('aria-checked', 'true')
    expect(control).toBeChecked()
  })

  test('O12 an unchecked Switch reads aria-checked false and is not checked', () => {
    render(<Switch checked={false} onChange={() => {}} label="Track effort" />)

    const control = screen.getByRole('switch', { name: 'Track effort' })
    expect(control).toHaveAttribute('aria-checked', 'false')
    expect(control).not.toBeChecked()
  })

  test('O12 tapping an off Switch calls onChange with true', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Switch checked={false} onChange={onChange} label="barbell" />)

    await user.click(screen.getByRole('switch', { name: 'barbell' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  test('O12 tapping an on Switch calls onChange with false', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Switch checked onChange={onChange} label="barbell" />)

    await user.click(screen.getByRole('switch', { name: 'barbell' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  test('O12 a disabled Switch is disabled and tapping it does not call onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Switch checked={false} onChange={onChange} label="barbell" disabled />)

    const control = screen.getByRole('switch', { name: 'barbell' })
    expect(control).toBeDisabled()
    await user.click(control)
    expect(onChange).not.toHaveBeenCalled()
  })

  test('O12 a Switch renders no button', () => {
    const { container } = render(<Switch checked={false} onChange={() => {}} label="barbell" />)
    expect(screen.getByRole('switch', { name: 'barbell' })).toBeInTheDocument()
    expect(container.querySelector('button')).toBeNull()
  })
})

const UNIT_OPTIONS: { value: 'kg' | 'lb'; label: string }[] = [
  { value: 'kg', label: 'Kilograms' },
  { value: 'lb', label: 'Pounds' },
]

describe('[O12] Segmented', () => {
  test('O12 a Segmented is a radiogroup with the segmented class, named by its label', () => {
    render(<Segmented name="units" value="kg" options={UNIT_OPTIONS} onChange={() => {}} label="Units" />)

    const group = screen.getByRole('radiogroup', { name: 'Units' })
    expect(group).toHaveClass('segmented')
  })

  test('O12 a Segmented renders one native radio per option, each sharing the name and named by its label', () => {
    render(<Segmented name="units" value="kg" options={UNIT_OPTIONS} onChange={() => {}} label="Units" />)

    const group = screen.getByRole('radiogroup', { name: 'Units' })
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(2)
    for (const radio of radios) {
      expect(radio.tagName).toBe('INPUT')
      expect(radio).toHaveAttribute('type', 'radio')
      expect(radio).toHaveAttribute('name', 'units')
    }
    expect(within(group).getByRole('radio', { name: 'Kilograms' })).toBeInTheDocument()
    expect(within(group).getByRole('radio', { name: 'Pounds' })).toBeInTheDocument()
  })

  test('O12 only the radio matching value is checked', () => {
    render(<Segmented name="units" value="lb" options={UNIT_OPTIONS} onChange={() => {}} label="Units" />)

    expect(screen.getByRole('radio', { name: 'Pounds' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Kilograms' })).not.toBeChecked()
  })

  test('O12 choosing another option calls onChange with that option value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Segmented name="units" value="kg" options={UNIT_OPTIONS} onChange={onChange} label="Units" />)

    await user.click(screen.getByRole('radio', { name: 'Pounds' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('lb')
  })

  test('O12 a Segmented with no options renders an empty radiogroup', () => {
    render(<Segmented name="units" value="kg" options={[]} onChange={() => {}} label="Units" />)

    const group = screen.getByRole('radiogroup', { name: 'Units' })
    expect(within(group).queryAllByRole('radio')).toHaveLength(0)
  })

  test('O12 a Segmented renders no button', () => {
    const { container } = render(
      <Segmented name="units" value="kg" options={UNIT_OPTIONS} onChange={() => {}} label="Units" />,
    )
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(container.querySelector('button')).toBeNull()
  })
})

describe('[O12] Select', () => {
  function renderStepSelect(onChange = vi.fn()) {
    render(
      <Select aria-label="Weight step" value="2.5" onChange={onChange}>
        <option value="1.25">1.25</option>
        <option value="2.5">2.5</option>
        <option value="5">5</option>
      </Select>,
    )
    return onChange
  }

  test('O12 a Select is a native select element with the select class', () => {
    renderStepSelect()

    const select = screen.getByRole('combobox', { name: 'Weight step' })
    expect(select.tagName).toBe('SELECT')
    expect(select).toHaveClass('select')
  })

  test('O12 a Select passes its options and value through to the native select', () => {
    renderStepSelect()

    const select = screen.getByRole('combobox', { name: 'Weight step' }) as HTMLSelectElement
    expect(select.value).toBe('2.5')
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      '1.25',
      '2.5',
      '5',
    ])
  })

  test('O12 picking an option in the native picker calls the Select onChange with that value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn((event: React.ChangeEvent<HTMLSelectElement>) => event.target.value)
    renderStepSelect(onChange)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Weight step' }), '5')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.results[0].value).toBe('5')
  })

  test('O12 a Select draws the ChevronDown icon beside the native select, hidden from assistive tech', () => {
    const { container } = render(
      <Select aria-label="Weight step" defaultValue="5">
        <option value="5">5</option>
      </Select>,
    )

    const select = screen.getByRole('combobox', { name: 'Weight step' })
    const chevron = container.querySelector(`svg path[d="${CHEVRON_DOWN_PATH}"]`)
    expect(chevron, 'the ChevronDown icon must be rendered').not.toBeNull()
    const svg = (chevron as Element).closest('svg') as SVGElement
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    // Beside it, not inside it: a native <select> renders only its options.
    expect(select.contains(svg)).toBe(false)
  })

  test('O12 a disabled Select stays a disabled native select', () => {
    render(
      <Select aria-label="Weight step" disabled defaultValue="5">
        <option value="5">5</option>
      </Select>,
    )

    expect(screen.getByRole('combobox', { name: 'Weight step' })).toBeDisabled()
  })

  test('O12 a Select renders no button', () => {
    const { container } = render(
      <Select aria-label="Weight step" defaultValue="5">
        <option value="5">5</option>
      </Select>,
    )
    expect(screen.getByRole('combobox', { name: 'Weight step' })).toBeInTheDocument()
    expect(container.querySelector('button')).toBeNull()
  })
})
