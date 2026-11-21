// DX-13: one sync status line, under the Sessions title, in the trainee's words; a tap opens
// Settings. DX-21: the empty Sessions tab still draws its calendar, with one line and one action.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { SyncView } from '../../services/sync'
import { SyncLine, syncLineText } from './SyncLine'

const NOW = new Date(2026, 9, 15, 18, 0).getTime()
const view = (change: Partial<SyncView>): SyncView => ({ accountEmail: null, lastSyncedAt: null, status: 'idle', ...change })

test('DX-13 never signed in, the line says the Sessions are on this phone only', () => {
  expect(syncLineText(view({}), NOW)).toBe('Saved on this phone · not synced')
  // In dev mode (no /api) a sync fails, but with no account it still reads the same.
  expect(syncLineText(view({ status: 'error', message: 'offline' }), NOW)).toBe('Saved on this phone · not synced')
  expect(syncLineText(view({ status: 'signed-out', accountEmail: 'a@b.c' }), NOW)).toBe('Saved on this phone · not synced')
})

test('DX-13 signed in, the line says when it last synced, or that it failed', () => {
  const synced = new Date(2026, 9, 15, 14, 2).getTime()
  expect(syncLineText(view({ accountEmail: 'a@b.c', lastSyncedAt: synced, status: 'ok' }), NOW)).toBe('Synced 14:02')
  const earlier = new Date(2026, 9, 14, 9, 0).getTime()
  expect(syncLineText(view({ accountEmail: 'a@b.c', lastSyncedAt: earlier, status: 'idle' }), NOW)).toBe('Synced 14 Oct')
  expect(syncLineText(view({ accountEmail: 'a@b.c', lastSyncedAt: synced, status: 'error' }), NOW)).toBe(
    'Sync failed · Try again',
  )
  expect(syncLineText(view({ accountEmail: 'a@b.c', status: 'syncing' }), NOW)).toBe('Syncing…')
})

test('DX-13 with somewhere to go, the line is a button that opens Settings; without, plain text', async () => {
  const onOpen = vi.fn()
  const { rerender } = render(<SyncLine sync={view({})} now={NOW} onOpen={onOpen} />)

  await userEvent.click(screen.getByRole('button', { name: 'Saved on this phone · not synced' }))
  expect(onOpen).toHaveBeenCalledTimes(1)

  rerender(<SyncLine sync={view({})} now={NOW} />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.getByText('Saved on this phone · not synced')).toBeVisible()
})
