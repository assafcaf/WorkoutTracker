import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { NotificationSettings, type NotificationSettingsProps, type NotificationStatus } from './NotificationSettings'

function setup(overrides: Partial<NotificationSettingsProps> = {}) {
  const props: NotificationSettingsProps = {
    status: 'off',
    onEnable: vi.fn(),
    onDisable: vi.fn(),
    reminders: null,
    onRemindersChange: vi.fn(),
    ...overrides,
  }
  render(<NotificationSettings {...props} />)
  return props
}

const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

test('O25 off shows Turn on notifications and the tap calls enable', async () => {
  const props = setup({ status: 'off' })
  await userEvent.click(screen.getByRole('button', { name: 'Turn on notifications' }))
  expect(props.onEnable).toHaveBeenCalledTimes(1)
})

test('O25 on shows Turn off and the tap calls disable', async () => {
  const props = setup({ status: 'on' })
  await userEvent.click(screen.getByRole('button', { name: 'Turn off' }))
  expect(props.onDisable).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Turn on notifications' })).toBeNull()
})

test.each<[NotificationStatus, RegExp]>([
  ['unsupported', /can.t send notifications/i],
  ['not-installed', /Home Screen/i],
  ['denied', /iOS Settings/i],
  ['unconfigured', /aren.t set up/i],
  ['signed-out', /sign in/i],
])('O25 %s shows one explaining line and no button', (status, line) => {
  setup({ status })
  expect(screen.getByText(line)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /turn on|turn off/i })).toBeNull()
})

test('O26 weekday chips follow Week start order', () => {
  setup({ status: 'on', weekStart: 3 })
  const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')).filter(Boolean)
  expect(names).toEqual(['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday'])
})

test('O26 Sunday plus Wednesday at 18:00 stores days, time and the resolved zone', async () => {
  const props = setup({ status: 'on' })
  await userEvent.click(screen.getByRole('button', { name: 'Sunday' }))
  await userEvent.click(screen.getByRole('button', { name: 'Wednesday' }))
  expect(props.onRemindersChange).toHaveBeenLastCalledWith({ days: [0, 3], time: '18:00', timeZone: ZONE })
})

test('O26 Off stores null', async () => {
  const props = setup({ status: 'on', reminders: { days: [0, 3], time: '18:00', timeZone: ZONE } })
  await userEvent.click(screen.getByRole('button', { name: 'Off' }))
  expect(props.onRemindersChange).toHaveBeenLastCalledWith(null)
})

test('O26 with push not on, the reminders show disabled with the hint', () => {
  setup({ status: 'off' })
  expect(screen.getByText('Turn on notifications first')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Sunday' }) as HTMLButtonElement).disabled).toBe(true)
})
