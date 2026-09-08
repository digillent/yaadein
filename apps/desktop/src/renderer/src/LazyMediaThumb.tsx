import { useEffect, useRef, useState } from 'react'
import { buildLocalMediaPreview } from '@shared/buildLocalMediaPreview'

type Props = {
  absolutePath: string
  alt: string
  className?: string
}

/** Defer attaching media src until the thumb is near the viewport. */
export function LazyMediaThumb({ absolutePath, alt, className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(false)
  const preview = buildLocalMediaPreview(absolutePath)
  const src = active ? preview.streamUrl : null

  useEffect(() => {
    const node = rootRef.current
    if (!node) {
      return
    }
    if (typeof IntersectionObserver === 'undefined') {
      setActive(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px 0px', threshold: 0.01 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [absolutePath])

  return (
    <div ref={rootRef} className={className}>
      {preview.kind === 'video' && src ? (
        <video src={src} muted playsInline preload="metadata" />
      ) : preview.kind === 'image' && src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" />
      ) : (
        <span className="hint">…</span>
      )}
    </div>
  )
}
