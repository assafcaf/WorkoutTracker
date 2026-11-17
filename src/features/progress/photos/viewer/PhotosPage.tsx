import { useState } from 'react'
import { dayOf } from '../../../../domain/bodyLog'
import type { Services } from '../../../../services'
import type { Photo } from '../../../../storage/photoStore'
import type { BodyLog } from '../../../../types'
import { AppShell } from '../../../../ui/AppShell'
import { useServices } from '../../../ServicesProvider'
import { useServiceData } from '../../../useServiceData'
import { PhotoCaptureFlow } from '../capture/PhotoCaptureFlow'
import type { ProgressPageProps } from '../../pages'
import { PhotosView } from './PhotosView'

type Loaded = { photos: Photo[]; log: BodyLog }

async function load(s: Services): Promise<Loaded> {
  const photos = await s.photos.list()
  const log = await s.preferences.bodyLog().catch((): BodyLog => [])
  return { photos, log }
}

export type PhotosPageProps = ProgressPageProps<'photos'> & {
  now?: () => number
  undoMs?: number
}

/**
 * The Progress tab's Photos page: every progress photo by angle, newest first, with a
 * full-screen viewer that steps between dates, plays them as a timelapse and opens Compare.
 */
export function PhotosPage({ push, onBack, now = Date.now, undoMs }: PhotosPageProps): JSX.Element {
  const services = useServices()
  const loaded = useServiceData(load, ['preferences'])
  const [capturing, setCapturing] = useState(false)
  const at = now()

  if (capturing) return <PhotoCaptureFlow day={dayOf(at)} onClose={() => setCapturing(false)} />
  if (loaded.status !== 'ready') return <AppShell title="Photos" onBack={onBack}>{null}</AppShell>
  return (
    <PhotosView
      {...loaded.data}
      now={at}
      onBack={onBack}
      onAdd={() => setCapturing(true)}
      onCompare={(request) => push({ kind: 'compare', ...request })}
      onDelete={(photo) => services.photos.remove(photo.id)}
      onRestore={(photo) => services.photos.restore(photo)}
      undoMs={undoMs}
    />
  )
}
