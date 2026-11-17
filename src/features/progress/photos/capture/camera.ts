/** A live camera preview the capture screen draws and takes a frame from. */
export type LiveFeed = {
  /** Shows the stream in `video`. */
  attach(video: HTMLVideoElement): void
  /** The current frame as an image. */
  grab(): Promise<Blob>
  /** Ends the stream. */
  stop(): void
}

/** Opens the front camera; rejects when it cannot (the screen then falls back to the file input). */
export type OpenCamera = () => Promise<LiveFeed>

/** How long the camera may take to show a first frame before it counts as failed. */
const FIRST_FRAME_MS = 3000

/**
 * The browser's camera. Rejects when there is no camera API, the stream is refused, its track
 * is ended or muted, or no frame arrives within 3 s (WebKit's getUserMedia can freeze).
 */
export const openDeviceCamera: OpenCamera = async () => {
  const devices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
  if (!devices?.getUserMedia) throw new Error('no camera API')
  const stream = await devices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
  const stop = (): void => stream.getTracks().forEach((track) => track.stop())
  const track = stream.getVideoTracks()[0]
  if (!track || track.readyState === 'ended' || track.muted) {
    stop()
    throw new Error('the camera track is not live')
  }
  const probe = document.createElement('video')
  probe.muted = true
  probe.playsInline = true
  probe.srcObject = stream
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no frame in time')), FIRST_FRAME_MS)
      probe.addEventListener(
        'loadeddata',
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true },
      )
      void probe.play().catch(reject)
    })
  } catch (error) {
    stop()
    throw error
  }
  return {
    attach(video) {
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      void video.play().catch(() => undefined)
    },
    grab() {
      const canvas = document.createElement('canvas')
      canvas.width = probe.videoWidth
      canvas.height = probe.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return Promise.reject(new Error('Canvas is not available'))
      ctx.drawImage(probe, 0, 0)
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no frame'))), 'image/jpeg', 0.9)
      })
    },
    stop,
  }
}
