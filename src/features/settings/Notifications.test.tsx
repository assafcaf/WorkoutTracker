import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createBackupService } from '../../services/backup'
import { createCatalogService } from '../../services/catalog'
import { createChangeBus } from '../../services/changes'
import { createPreferenceService } from '../../services/preferences'
import { createProgramService } from '../../services/programs'
import { createSessionService } from '../../services/sessions'
import type { PushEnableResult, PushStatus, Services, SyncResult } from '../../services'
import type { Reminders } from '../../contract'
import { ServicesProvider } from '../ServicesProvider'
import { SettingsFeature } from './SettingsFeature'

const NOW = 1_700_000_000_000
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

function build(initial: PushStatus, enableResult: PushEnableResult = 'on') {
  const bus = createChangeBus()
  const deps = { now: () => NOW, bus, storageAvailable: true }
  const ok: SyncResult = { status: 'ok', at: NOW, pushed: 0, pulled: 0 }
  let status = initial
  let stored: Reminders | null = null
  const push = {
    status: vi.fn(async () => status),
    enable: vi.fn(async () => {
      if (enableResult === 'on') status = 'on'
      return enableResult
    }),
    disable: vi.fn(async () => {
      status = 'off'
      return 'off' as PushStatus
    }),
    scheduleRest: vi.fn(async () => {}),
    cancelRest: vi.fn(async () => {}),
    reminders: vi.fn(async () => stored),
    setReminders: vi.fn(async (value: Reminders | null) => {
      stored = value
      bus.emit('preferences')
    }),
  }
  const services: Services = {
    sessions: createSessionService(deps),
    programs: createProgramService(deps),
    preferences: createPreferenceService(deps),
    catalog: createCatalogService(deps),
    backup: createBackupService({ ...deps, replaceRemote: async () => ok }),
    transfer: {} as Services['transfer'],
    sync: {
      state: async () => ({ accountEmail: null, lastSyncedAt: null }),
      syncNow: async () => ok,
      replaceRemote: async () => ok,
      adoptAccount: async () => {},
    },
    push,
    bus,
  }
  render(
    <ServicesProvider services={services}>
      <SettingsFeature navigate={vi.fn()} onInSession={vi.fn()} />
    </ServicesProvider>,
  )
  return push
}

test('O25 an off status shows Turn on notifications and the tap calls enable, then Turn off', async () => {
  const push = build('off')
  await userEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }))
  expect(push.enable).toHaveBeenCalledTimes(1)
  await userEvent.click(await screen.findByRole('button', { name: 'Turn off' }))
  expect(push.disable).toHaveBeenCalledTimes(1)
})

test('O25 not-installed explains and shows no button; the rest of Settings stays', async () => {
  build('not-installed')
  expect(await screen.findByText(/Home Screen/i)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Turn on notifications' })).toBeNull()
  expect(screen.getByRole('group', { name: 'Active program' })).toBeTruthy()
})

test('O25 an enable that finds the server unconfigured explains it', async () => {
  build('off', 'unconfigured')
  await userEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }))
  expect(await screen.findByText(/aren.t set up/i)).toBeTruthy()
})

test('O26 Sunday plus Wednesday at 18:00 is stored through the push service', async () => {
  const push = build('on')
  await userEvent.click(await screen.findByRole('button', { name: 'Sunday' }))
  await userEvent.click(screen.getByRole('button', { name: 'Wednesday' }))
  await waitFor(() =>
    expect(push.setReminders).toHaveBeenLastCalledWith({ days: [0, 3], time: '18:00', timeZone: ZONE }),
  )
})

test('O26 Off stores null', async () => {
  const push = build('on')
  await userEvent.click(await screen.findByRole('button', { name: 'Sunday' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Off' }))
  await waitFor(() => expect(push.setReminders).toHaveBeenLastCalledWith(null))
})
