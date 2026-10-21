import { useEffect, useRef, useState, type WheelEvent } from 'react'
import { formatMediaClock } from './formatMediaClock'

type Layout = 'review' | 'focus' | 'compare'

type Props = {
  src: string
  /** Picture zoom only. Controls stay at normal size so seeking stays accurate. */
  zoom?: number
  autoPlay?: boolean
  layout?: Layout
}

function stopWheel(event: WheelEvent<HTMLDivElement>): void {
  event.stopPropagation()
}

/**
 * Local playback on the built-in decoder, with controls outside the picture.
 * Native controls sit inside the element, so CSS zoom makes the scrubber miss clicks.
 */
export function LocalVideoPlayer({
  src,
  zoom = 1,
  autoPlay = false,
  layout = 'review',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(autoPlay)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setPlaying(autoPlay)
    setCurrent(0)
    setDuration(0)
    setFailed(false)
  }, [src, autoPlay])

  function togglePlay(): void {
    const video = videoRef.current
    if (!video) {
      return
    }
    if (video.paused) {
      void video.play()
      return
    }
    video.pause()
  }

  if (failed) {
    return <p className="hint">This video cannot be played (unsupported codec).</p>
  }

  const zoomed = zoom > 1
  return (
    <div className={`videoPlayer videoPlayer-${layout}`}>
      <div className="videoPlayerFrame">
        <video
          key={src}
          ref={videoRef}
          className="videoPlayerMedia"
          src={src}
          autoPlay={autoPlay}
          playsInline
          preload="metadata"
          muted={muted}
          style={
            zoomed
              ? { width: `${Math.round(zoom * 100)}%`, maxWidth: 'none', maxHeight: 'none' }
              : undefined
          }
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(event) => {
            const next = event.currentTarget.duration
            setDuration(Number.isFinite(next) ? next : 0)
          }}
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
          onEnded={() => setPlaying(false)}
          onError={() => setFailed(true)}
        />
      </div>
      <div className="videoPlayerControls" onWheel={stopWheel}>
        <button type="button" onClick={togglePlay}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <input
          className="videoPlayerSeek"
          type="range"
          min={0}
          max={duration > 0 ? duration : 0}
          step={0.01}
          value={duration > 0 ? Math.min(current, duration) : 0}
          aria-label="Seek"
          disabled={duration <= 0}
          onChange={(event) => {
            const next = Number(event.target.value)
            const video = videoRef.current
            if (video && Number.isFinite(next)) {
              video.currentTime = next
            }
            setCurrent(next)
          }}
        />
        <span className="videoPlayerTime">
          {formatMediaClock(current)} / {formatMediaClock(duration)}
        </span>
        <button type="button" onClick={() => setMuted((value) => !value)}>
          {muted ? 'Unmute' : 'Mute'}
        </button>
      </div>
    </div>
  )
}
