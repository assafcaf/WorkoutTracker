import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { StorageUnavailableBanner } from './StorageUnavailableBanner'

// The banner is presentational: E1-T6 mounts it when `isStorageAvailable()` is false and
// disables the logging controls. These tests only pin what it says and how it is announced.
const CANNOT_BE_SAVED = /(cannot|can not|can't|won't|will not) be saved/i

function bannerText(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

test('O19 the banner states that sets cannot be saved', () => {
  render(<StorageUnavailableBanner />)

  const text = bannerText()
  expect(text).toMatch(/\bsets?\b/i)
  expect(text).toMatch(CANNOT_BE_SAVED)
})

test('O19 the banner is announced as an alert so the warning is not missed', () => {
  render(<StorageUnavailableBanner />)

  const alert = screen.getByRole('alert')
  expect(alert).toBeVisible()
  expect((alert.textContent ?? '').replace(/\s+/g, ' ')).toMatch(CANNOT_BE_SAVED)
})
