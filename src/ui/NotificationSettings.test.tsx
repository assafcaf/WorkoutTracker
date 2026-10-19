import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { PushTestOutcome } from '../services/push'
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

test('E25-T1 O5 on shows Send a test notification as a quiet settings action and the tap calls onTest', async () => {
  const props = setup({ status: 'on', onTest: vi.fn() })
  const button = screen.getByRole('button', { name: 'Send a test notification' })
  expect(button.className).toContain('settings-action')
  expect(button.className).toContain('btn-quiet')
  await userEvent.click(button)
  expect(props.onTest).toHaveBeenCalledTimes(1)
})

test.each<NotificationStatus>(['off', 'unsupported', 'not-installed', 'denied', 'unconfigured', 'signed-out'])(
  'E25-T1 O5 %s shows no test button',
  (status) => {
    setup({ status, onTest: vi.fn() })
    expect(screen.queryByRole('button', { name: 'Send a test notification' })).toBeNull()
  },
)

test('E25-T1 O5 before any test there is no result line', () => {
  setup({ status: 'on', onTest: vi.fn(), testResult: null })
  expect(screen.queryByText(/^Sent to|^Failed|No device is subscribed/)).toBeNull()
})

test.each([
  [{ subscriptions: 1, results: [{ host: 'h', result: 'sent', status: 201, reason: null }] }, 'Sent to 1 device'],
  [{ subscriptions: 0, results: [] }, 'No device is subscribed. Turn notifications off and on again.'],
  [
    { subscriptions: 1, results: [{ host: 'h', result: 'failed', status: 403, reason: 'BadJwtToken' }] },
    'Failed: 403 BadJwtToken',
  ],
  [
    {
      subscriptions: 2,
      results: [
        { host: 'a', result: 'sent', status: 201, reason: null },
        { host: 'b', result: 'failed', status: 403, reason: 'BadJwtToken' },
      ],
    },
    'Failed: 403 BadJwtToken',
  ],
] as const)('E25-T1 O5 the answer %j reads one line', (testResult, line) => {
  setup({ status: 'on', onTest: vi.fn(), testResult: testResult as unknown as PushTestOutcome })
  expect(screen.getByText(line)).toBeTruthy()
})

test.each(['signed-out', 'unconfigured', 'failed'] as const)(
  'E25-T1 O5 the service error %s reads a line starting Failed',
  (error) => {
    setup({ status: 'on', onTest: vi.fn(), testResult: { error } })
    expect(screen.getByText(/^Failed/)).toBeTruthy()
  },
)
