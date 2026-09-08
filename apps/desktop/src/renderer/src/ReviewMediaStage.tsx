import { useEffect, useState, type WheelEvent } from 'react'
import { buildLocalMediaPreview } from '@shared/buildLocalMediaPreview'

const MIN_ZOOM = 1
const MAX_ZOOM = 6

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function nextZoom(current: number, direction: 'in' | 'out'): number {
  const factor = direction === 'in' ? 1.25 : 1 / 1.25
  return clampZoom(Number((current * factor).toFixed(3)))
}

type Props = {
  currentReviewPath: string | null
}

/** Zoomable image/video stage for Tinder-style review (sync stream URL; no IPC flash). */
export function ReviewMediaStage({ currentReviewPath }: Props) {
  const [zoom, setZoom] = useState(1)
  const preview = currentReviewPath ? buildLocalMediaPreview(currentReviewPath) : null
  const mediaSrc = preview?.streamUrl ?? null

  useEffect(() => {
    setZoom(1)
  }, [currentReviewPath])

  function onWheel(event: WheelEvent<HTMLDivElement>): void {
    if (!mediaSrc || preview?.kind === 'unsupported') {
      return
    }
    event.preventDefault()
    setZoom((current) => nextZoom(current, event.deltaY < 0 ? 'in' : 'out'))
  }

  return (
    <>
      <div className="row reviewZoomRow">
        <button
          type="button"
          disabled={!mediaSrc || zoom <= MIN_ZOOM}
          onClick={() => setZoom((current) => nextZoom(current, 'out'))}
        >
          Zoom −
        </button>
        <button
          type="button"
          disabled={!mediaSrc || zoom >= MAX_ZOOM}
          onClick={() => setZoom((current) => nextZoom(current, 'in'))}
        >
          Zoom +
        </button>
        <button type="button" disabled={!mediaSrc || zoom === 1} onClick={() => setZoom(1)}>
          Reset
        </button>
        <span className="reviewZoomLabel">{Math.round(zoom * 100)}%</span>
      </div>
      <div
        className={`reviewStage${zoom > 1 ? ' reviewStageZoomed' : ''}`}
        onWheel={onWheel}
      >
        {preview?.kind === 'video' && mediaSrc ? (
          <video
            key={currentReviewPath ?? 'none'}
            className="reviewMedia"
            src={mediaSrc}
            controls
            autoPlay
            playsInline
            style={{ transform: `scale(${zoom})` }}
          />
        ) : preview?.kind === 'image' && mediaSrc ? (
          <img
            key={currentReviewPath ?? 'none'}
            className="reviewMedia"
            src={mediaSrc}
            alt={currentReviewPath ?? ''}
            style={{ transform: `scale(${zoom})` }}
            draggable={false}
          />
        ) : currentReviewPath ? (
          <p className="hint">No preview for this file type.</p>
        ) : (
          <p className="hint">Nothing to review.</p>
        )}
      </div>
    </>
  )
}
