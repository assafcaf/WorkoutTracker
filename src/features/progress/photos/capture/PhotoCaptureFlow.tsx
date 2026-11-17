import { useServiceData } from '../../../useServiceData'
import { useServices } from '../../../ServicesProvider'
import { PhotoCapture } from './PhotoCapture'

/** The capture screen over the photos service: reads the existing photos and saves the new one. */
export function PhotoCaptureFlow({ day, onClose }: { day: string; onClose(): void }): JSX.Element | null {
  const photos = useServiceData((s) => s.photos.list(), ['preferences'])
  const services = useServices()
  if (photos.status === 'loading') return null
  return (
    <PhotoCapture
      photos={photos.status === 'ready' ? photos.data : []}
      day={day}
      onSave={async (input) => {
        await services.photos.add(input)
      }}
      onClose={onClose}
    />
  )
}
