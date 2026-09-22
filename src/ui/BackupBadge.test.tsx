// E2-T6 / O11: a backup reminder badge on the settings entry, at 14 days.
//
// O11 names two cases directly — 15 days ago shows the badge, 13 days ago shows nothing — and
// the plan's decision 5 adds a third: a database that has never been exported (`null`) counts
// as due from the start, same as an old export. `isBackupDue` is specified as true "when MORE
// than 14 days have passed", so the exact boundary — 14 days to the millisecond — is pinned
// here as NOT due, so an implementer cannot flip the comparison and still pass.
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BACKUP_REMINDER_DAYS, BackupBadge, isBackupDue } from './BackupBadge'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 8, 22) // 2026-09-22, this task's "today"

test('O11 BACKUP_REMINDER_DAYS is 14', () => {
  expect(BACKUP_REMINDER_DAYS).toBe(14)
})

test('O11 isBackupDue is true when the last export was 15 days ago', () => {
  expect(isBackupDue(NOW - 15 * DAY, NOW)).toBe(true)
})

test('O11 isBackupDue is false when the last export was 13 days ago', () => {
  expect(isBackupDue(NOW - 13 * DAY, NOW)).toBe(false)
})

test('O11 isBackupDue is false at exactly 14 days, the boundary is more-than not at-least', () => {
  expect(isBackupDue(NOW - 14 * DAY, NOW)).toBe(false)
})

test('O11 isBackupDue is true when there is no recorded export at all', () => {
  expect(isBackupDue(null, NOW)).toBe(true)
})

test('O11 BackupBadge shows an invitation to back up when the last export was 15 days ago', () => {
  render(<BackupBadge lastExportedAt={NOW - 15 * DAY} now={NOW} />)

  expect(screen.getByRole('status')).toHaveTextContent(/back ?up/i)
})

test('O11 BackupBadge renders nothing when the last export was 13 days ago', () => {
  const { container } = render(<BackupBadge lastExportedAt={NOW - 13 * DAY} now={NOW} />)

  expect(container).toBeEmptyDOMElement()
})

test('O11 BackupBadge shows an invitation to back up when the database was never exported', () => {
  render(<BackupBadge lastExportedAt={null} now={NOW} />)

  expect(screen.getByRole('status')).toHaveTextContent(/back ?up/i)
})
