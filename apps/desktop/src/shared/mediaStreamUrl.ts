/** Privileged scheme registered in Electron main for local img/video streaming. */
export const MEDIA_STREAM_SCHEME = 'yaadein-media'

/** Build a renderer-safe stream URL for an absolute local media path. */
export function buildMediaStreamUrl(absolutePath: string): string {
  const url = new URL(`${MEDIA_STREAM_SCHEME}://local/`)
  url.searchParams.set('path', absolutePath)
  return url.href
}

export function absolutePathFromMediaStreamUrl(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== `${MEDIA_STREAM_SCHEME}:`) {
      return null
    }
    const path = url.searchParams.get('path')
    return path && path.trim() ? path : null
  } catch {
    return null
  }
}
