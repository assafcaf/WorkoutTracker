import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, SyntheticEvent } from 'react'
import type { PhotoAlign, PhotoAngle, PhotoBodyLines } from '../../../../storage/photoStore'
import { IDENTITY_ALIGN, cssTransform, dragged, pinched } from './align'
import type { Point } from './align'
import { containedBox, movedLines } from './lines'
import { useObjectUrl } from './useObjectUrl'

/** Where the head and feet lines start when the trainee first marks them. */
const DEFAULT_LINES: PhotoBodyLines = { head: 0.08, feet: 0.95 }
/** The stage is drawn 3:4. */
const STAGE_ASPECT = 3 / 4

/**
 * Lines the new photo up over the reference by a stored transform (L1), and optionally marks the
 * top of the head and the soles on it: the next live capture shows them as the no-model distance
 * guide. The photo's pixels never change.
 */
export function AlignView({
  image,
  angle,
  referenceUrl,
  referenceAlign,
  initialLines,
  onRetake,
  onSave,
}: {
  image: Blob
  angle: PhotoAngle
  referenceUrl: string | null
  referenceAlign: PhotoAlign | null
  /** Lines the pose model already found on this photo, if any. */
  initialLines: PhotoBodyLines | null
  onRetake(): void
  onSave(align: PhotoAlign, lines: PhotoBodyLines | null): Promise<void>
}): JSX.Element {
  const url = useObjectUrl(image)
  const [align, setAlign] = useState<PhotoAlign>(IDENTITY_ALIGN)
  const [ghost, setGhost] = useState(50)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lines, setLines] = useState<PhotoBodyLines | null>(initialLines)
  const [aspect, setAspect] = useState<number | null>(null)
  const pointers = useRef(new Map<number, Point>())
  const lineDrag = useRef<{ which: keyof PhotoBodyLines; y: number } | null>(null)
  const stage = useRef<HTMLDivElement>(null)

  const box = containedBox(aspect ?? STAGE_ASPECT, STAGE_ASPECT)

  const pos = (event: ReactPointerEvent): Point => ({ x: event.clientX, y: event.clientY })
  const down = (event: ReactPointerEvent<HTMLDivElement>): void => {
    pointers.current.set(event.pointerId, pos(event))
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const move = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const before = pointers.current.get(event.pointerId)
    if (!before) return
    const now = pos(event)
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId).map(([, p]) => p)
    pointers.current.set(event.pointerId, now)
    const rect = event.currentTarget.getBoundingClientRect()
    if (others.length === 0) {
      setAlign((a) => dragged(a, now.x - before.x, now.y - before.y, { w: rect.width, h: rect.height }))
    } else {
      setAlign((a) => pinched(a, [before, others[0]], [now, others[0]]))
    }
  }
  const up = (event: ReactPointerEvent): void => {
    pointers.current.delete(event.pointerId)
  }

  // The lines move in the photo's own coordinates: a screen drag is divided by the drawn photo's height.
  const photoHeightPx = (): number => (stage.current?.getBoundingClientRect().height || 1) * box.height * align.scale
  const lineDown = (which: keyof PhotoBodyLines) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    lineDrag.current = { which, y: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const lineMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = lineDrag.current
    if (!drag) return
    event.stopPropagation()
    const dy = (event.clientY - drag.y) / photoHeightPx()
    drag.y = event.clientY
    setLines((l) => (l ? movedLines(l, drag.which, dy) : l))
  }
  const lineUp = (event: ReactPointerEvent): void => {
    event.stopPropagation()
    lineDrag.current = null
  }
  const lineKey = (which: keyof PhotoBodyLines) => (event: KeyboardEvent) => {
    const step = event.key === 'ArrowUp' ? -0.01 : event.key === 'ArrowDown' ? 0.01 : 0
    if (step === 0) return
    event.preventDefault()
    setLines((l) => (l ? movedLines(l, which, step) : l))
  }

  const loaded = (event: SyntheticEvent<HTMLImageElement>): void => {
    const img = event.currentTarget
    if (img.naturalWidth > 0 && img.naturalHeight > 0) setAspect(img.naturalWidth / img.naturalHeight)
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setError('')
    try {
      await onSave(align, lines)
    } catch {
      setError('Could not save the photo')
    } finally {
      setSaving(false)
    }
  }

  const lineHandle = (which: keyof PhotoBodyLines, label: string): JSX.Element | null =>
    lines ? (
      <div
        className="photo-mark"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(lines[which] * 100)}
        style={{ top: `${lines[which] * 100}%` }}
        onPointerDown={lineDown(which)}
        onPointerMove={lineMove}
        onPointerUp={lineUp}
        onPointerCancel={lineUp}
        onKeyDown={lineKey(which)}
      >
        <span className="photo-mark-line" />
      </div>
    ) : null

  return (
    <div className="photo-capture">
      <header className="photo-header">
        <button type="button" className="btn-quiet" onClick={onRetake}>
          Retake
        </button>
        <h1 className="photo-title">Line up</h1>
        <button type="button" className="btn-quiet" disabled={saving} onClick={() => void save()}>
          Save
        </button>
      </header>
      <div className="photo-body">
        <div
          ref={stage}
          className="photo-stage"
          role="group"
          aria-label="Alignment"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          {url ? <img className="photo-new" src={url} alt="New photo" style={{ transform: cssTransform(align) }} onLoad={loaded} /> : null}
          {referenceUrl && ghost > 0 ? (
            <img
              className="photo-ghost"
              src={referenceUrl}
              alt={`Last ${angle} photo`}
              style={{ opacity: ghost / 100, transform: cssTransform(referenceAlign) }}
            />
          ) : null}
          {lines ? (
            <div className="photo-marks" style={{ transform: cssTransform(align) }}>
              <div
                className="photo-marks-box"
                style={{
                  left: `${box.left * 100}%`,
                  top: `${box.top * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                }}
              >
                {lineHandle('head', 'Top of head')}
                {lineHandle('feet', 'Soles')}
              </div>
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="photo-note" role="alert">
            {error}
          </p>
        ) : null}
        <p className="photo-note">
          {lines
            ? 'Drag the two lines to the top of your head and your soles. Next time they show where to stand.'
            : 'Drag to move, pinch to resize and turn. The original photo is never changed.'}
        </p>
        <div className="photo-align-actions">
          <button type="button" className="btn-secondary" onClick={() => setAlign(IDENTITY_ALIGN)}>
            Reset
          </button>
          {referenceUrl ? (
            <button type="button" className="btn-secondary" onClick={() => setGhost(ghost === 50 ? 0 : 50)}>
              Ghost
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            aria-pressed={lines !== null}
            onClick={() => setLines(lines ? null : DEFAULT_LINES)}
          >
            Head & feet
          </button>
        </div>
      </div>
    </div>
  )
}
