/** `m:ss` or `h:mm:ss` for the video control bar. Non-finite values show as 0:00. */
export function formatMediaClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00'
  }
  const total = Math.floor(seconds)
  const secs = total % 60
  const mins = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  const secText = String(secs).padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${secText}`
  }
  return `${mins}:${secText}`
}
