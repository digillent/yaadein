import { protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { isMediaPath } from '../media/mediaType'

export const MEDIA_STREAM_SCHEME = 'yaadein-media'

/** Must run before app.whenReady(). */
export function registerMediaStreamScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_STREAM_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ])
}

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

/** Register after app.whenReady(). Serves local media for img/video in the renderer. */
export function registerMediaStreamProtocol(): void {
  protocol.handle(MEDIA_STREAM_SCHEME, (request) => {
    const filePath = absolutePathFromMediaStreamUrl(request.url)
    if (!filePath || !existsSync(filePath) || !isMediaPath(filePath)) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).href)
  })
}
