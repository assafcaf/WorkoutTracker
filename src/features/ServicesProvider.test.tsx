import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { createChangeBus } from '../services/changes'
import type { Services, SyncResult, SyncService } from '../services'
import { ServicesProvider, useServices, useSyncControls } from './ServicesProvider'
import type { UseSync } from './useSync'

// Only sync is exercised here, so the other services are inert placeholders the provider must
// pass through untouched. Sync is a double of the real SyncService: a signed-in phone whose
// every sync answers ok.

const T0 = 1_700_000_000_000
const SETTLE = { timeout: 2000 }

function countingSync(): SyncService & { syncNow: ReturnType<typeof vi.fn> } {
  const ok: SyncResult = { status: 'ok', at: T0, pushed: 0, pulled: 0 }
  return {
    state: async () => ({ accountEmail: 'trainee@example.com', lastSyncedAt: T0 }),
    syncNow: vi.fn(async () => ok),
    replaceRemote: async () => ok,
    adoptAccount: async () => {},
  }
}

function servicesWith(sync: SyncService): Services {
  return {
    sessions: {} as Services['sessions'],
    programs: {} as Services['programs'],
    preferences: {} as Services['preferences'],
    catalog: {} as Services['catalog'],
    backup: {} as Services['backup'],
    sync,
    bus: createChangeBus(),
  }
}

function SyncStatus({ label, onControls }: { label: string; onControls?: (c: UseSync) => void }): JSX.Element {
  const controls = useSyncControls()
  onControls?.(controls)
  return (
    <p data-testid={label}>
      {controls.sync.status} {controls.sync.accountEmail}
    </p>
  )
}

test('D7 ServicesProvider syncs once on mount however many descendants read the sync controls', async () => {
  const sync = countingSync()

  render(
    <ServicesProvider services={servicesWith(sync)}>
      <SyncStatus label="first" />
      <SyncStatus label="second" />
      <SyncStatus label="third" />
    </ServicesProvider>,
  )

  await waitFor(() => expect(screen.getByTestId('first')).toHaveTextContent('ok trainee@example.com'), SETTLE)
  expect(sync.syncNow).toHaveBeenCalledTimes(1)
})

test('D7 useSyncControls gives every descendant the same sync view', async () => {
  const sync = countingSync()

  render(
    <ServicesProvider services={servicesWith(sync)}>
      <SyncStatus label="first" />
      <div>
        <SyncStatus label="nested" />
      </div>
    </ServicesProvider>,
  )

  await waitFor(() => expect(screen.getByTestId('first')).toHaveTextContent('ok trainee@example.com'), SETTLE)
  expect(screen.getByTestId('nested')).toHaveTextContent('ok trainee@example.com')
})

test("D7 useSyncControls' syncNow runs the provider's sync service", async () => {
  const sync = countingSync()
  let controls: UseSync | undefined

  render(
    <ServicesProvider services={servicesWith(sync)}>
      <SyncStatus label="first" onControls={(c) => (controls = c)} />
    </ServicesProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('first')).toHaveTextContent('ok trainee@example.com'), SETTLE)

  await act(async () => {
    await controls!.syncNow()
  })

  expect(sync.syncNow).toHaveBeenCalledTimes(2)
})

test('D7 useServices returns the services the provider was given', async () => {
  const services = servicesWith(countingSync())
  let got: Services | undefined

  function Reader(): JSX.Element {
    got = useServices()
    return <p>read</p>
  }

  render(
    <ServicesProvider services={services}>
      <Reader />
    </ServicesProvider>,
  )

  expect(await screen.findByText('read')).toBeInTheDocument()
  expect(got).toBe(services)
})

test('D7 ServicesProvider renders its children', async () => {
  const user = userEvent.setup()
  const clicked = vi.fn()

  render(
    <ServicesProvider services={servicesWith(countingSync())}>
      <button type="button" onClick={clicked}>
        Inside
      </button>
    </ServicesProvider>,
  )

  await user.click(screen.getByRole('button', { name: 'Inside' }))
  expect(clicked).toHaveBeenCalledTimes(1)
})
