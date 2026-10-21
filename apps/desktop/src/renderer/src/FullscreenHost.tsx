import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'

type ArrowDirection = 'prev' | 'next'

type Props = {
  children: ReactNode
  disabled?: boolean
  className?: string
  /** Fired for ←/→ only while this frame is the fullscreen element. */
  onArrow?: (direction: ArrowDirection) => void
}

export function fullscreenControlLabel(active: boolean): string {
  return active ? 'Exit full screen' : 'Full screen'
}

/** Wraps a picture or video so it can fill the display. Escape leaves full screen. */
export function FullscreenHost({ children, disabled = false, className, onArrow }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const onArrowRef = useRef(onArrow)
  onArrowRef.current = onArrow
  const [active, setActive] = useState(false)

  useEffect(() => {
    function onChange(): void {
      setActive(document.fullscreenElement === ref.current)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const handler = onArrowRef.current
      if (!handler || document.fullscreenElement !== ref.current) {
        return
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return
      }
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }
      event.preventDefault()
      handler(event.key === 'ArrowLeft' ? 'prev' : 'next')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function toggle(): Promise<void> {
    const node = ref.current
    if (!node) {
      return
    }
    try {
      if (document.fullscreenElement === node) {
        await document.exitFullscreen()
        return
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
      await node.requestFullscreen()
    } catch {
      setActive(false)
    }
  }

  function onDoubleClick(event: MouseEvent<HTMLDivElement>): void {
    if (disabled) {
      return
    }
    const target = event.target
    if (target instanceof Element && target.closest('button, input, a, .videoPlayerControls')) {
      return
    }
    void toggle()
  }

  return (
    <div
      ref={ref}
      className={`mediaFullscreenTarget${className ? ` ${className}` : ''}`}
      onDoubleClick={onDoubleClick}
    >
      <div className="mediaFullscreenBar">
        <button type="button" disabled={disabled} onClick={() => void toggle()}>
          {fullscreenControlLabel(active)}
        </button>
      </div>
      {children}
    </div>
  )
}
