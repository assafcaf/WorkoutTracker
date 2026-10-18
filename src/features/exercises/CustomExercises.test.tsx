import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { alternativesFor } from '../../domain/alternatives'
import { createServices } from '../../services'
import { db } from '../../storage/db'
import { ServicesProvider } from '../ServicesProvider'
import { ExercisesFeature } from './ExercisesFeature'

const NOW = 1_700_000_000_000
const SETTLE = { timeout: 3000 }

beforeEach(async () => {
  await db.open()
  await db.settings.clear()
})

function renderFeature() {
  const services = createServices({ now: () => NOW, storageAvailable: true })
  render(
    <ServicesProvider services={services}>
      <ExercisesFeature initialMuscles={null} navigate={vi.fn()} />
    </ServicesProvider>,
  )
  return { user: userEvent.setup(), services }
}

async function createSledPush(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'New exercise' }, SETTLE))
  const form = await screen.findByRole('dialog', { name: 'New exercise' }, SETTLE)
  await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Zercher Sled Push')
  await user.click(
    within(within(form).getByRole('group', { name: 'Primary muscles' })).getByRole('button', { name: 'quadriceps' }),
  )
  await user.selectOptions(within(form).getByRole('combobox', { name: 'Equipment' }), 'dumbbell')
  await user.click(within(form).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New exercise' })).toBeNull(), SETTLE)
}

test('O19 a new custom Exercise is listed, found by search and filters, and its detail has no photo or video', async () => {
  const { user } = renderFeature()
  await createSledPush(user)

  const search = screen.getByRole('searchbox', { name: 'Search exercises' })
  await user.type(search, 'zercher sled')
  expect(await screen.findByRole('button', { name: /Zercher Sled Push/ }, SETTLE)).toBeVisible()

  await user.clear(search)
  await user.selectOptions(screen.getByRole('combobox', { name: 'Muscle' }), 'quadriceps')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Equipment' }), 'dumbbell')
  await user.type(search, 'zercher')
  await user.click(await screen.findByRole('button', { name: /Zercher Sled Push/ }, SETTLE))

  const detail = await screen.findByRole('dialog', { name: 'Zercher Sled Push' }, SETTLE)
  expect(within(detail).queryAllByRole('img')).toHaveLength(0)
  expect(within(detail).queryByRole('link', { name: /video/i })).toBeNull()
  expect(within(detail).getByRole('button', { name: 'Edit' })).toBeVisible()
})

test('O20 the catalog read lists a custom Exercise for the Program picker and for Alternatives', async () => {
  const { user, services } = renderFeature()
  await createSledPush(user)

  const { library } = await services.catalog.load()
  const custom = library.find((entry) => entry.name === 'Zercher Sled Push')
  expect(custom).toBeDefined()
  const target = library.find(
    (entry) => entry.id !== custom?.id && entry.mechanic === null && entry.primaryMuscles.includes('quadriceps'),
  )
  expect(target).toBeDefined()
  const map = new Map(library.map((entry) => [entry.id, entry] as const))
  const ids = alternativesFor(target!, map, null).map((entry) => entry.id)
  expect(ids).toContain(custom!.id)
})

test('O21 Edit renames a custom Exercise and the list shows the new name', async () => {
  const { user } = renderFeature()
  await createSledPush(user)
  await user.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'zercher')
  await user.click(await screen.findByRole('button', { name: /Zercher Sled Push/ }, SETTLE))
  const detail = await screen.findByRole('dialog', { name: 'Zercher Sled Push' }, SETTLE)
  await user.click(within(detail).getByRole('button', { name: 'Edit' }))

  const form = await screen.findByRole('dialog', { name: 'Edit exercise' }, SETTLE)
  const name = within(form).getByRole('textbox', { name: 'Name' })
  expect(name).toHaveValue('Zercher Sled Push')
  await user.clear(name)
  await user.type(name, 'Zercher Prowler')
  await user.click(within(form).getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit exercise' })).toBeNull(), SETTLE)
  await user.clear(screen.getByRole('searchbox', { name: 'Search exercises' }))
  await user.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'zercher')
  expect(await screen.findByRole('button', { name: /Zercher Prowler/ }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: /Zercher Sled Push/ })).toBeNull()
})
