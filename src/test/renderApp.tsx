import { render, type RenderResult } from '@testing-library/react'
import { App } from '../App'
import { createServices } from '../services'
import { isStorageAvailable } from '../storage/db'

/**
 * Renders `<App>` the way `main.tsx` starts it (E11-T15): the real services, built once over
 * whatever storage the test seeded, with `storageAvailable` probed as main.tsx probes it — so a
 * test that mocks `isStorageAvailable` still decides it — and a clock that follows the test's
 * (fake or real) `Date.now`.
 */
export async function renderApp(): Promise<RenderResult> {
  const services = createServices({
    now: () => Date.now(),
    storageAvailable: await isStorageAvailable(),
  })
  return render(<App services={services} />)
}
