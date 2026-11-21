// E26-T7: the Body page's Photos section opens the capture screen over the real services.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { createServices } from '../../../../services'
import { db } from '../../../../storage/db'
import { ServicesProvider } from '../../../ServicesProvider'
import { BodyPage } from '../../BodyPage'

const NOW = new Date(2026, 10, 17, 9, 0).getTime()

beforeEach(async () => {
  localStorage.clear()
  await db.open()
  await db.settings.clear()
  await db.photos.clear()
})

describe('E26-T7 O4 the entry point on Progress > Body', () => {
  test('DX-10 New check-in opens the capture screen; Close returns to the Body page', async () => {
    const services = createServices({ now: () => NOW, storageAvailable: true })
    const user = userEvent.setup()
    render(
      <ServicesProvider services={services}>
        <BodyPage page={{ kind: 'body' }} push={() => undefined} onBack={() => undefined} now={() => NOW} />
      </ServicesProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'New check-in' }, { timeout: 5000 }))
    // Capture opens straight onto the camera view (Front, Mirror the first time).
    expect(await screen.findByRole('heading', { name: 'Front, mirror' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(await screen.findByRole('button', { name: 'Log bodyweight' })).toBeVisible()
  })
})
