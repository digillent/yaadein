import { protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { isMediaPath } from '../media/mediaType'
import {
  MEDIA_STREAM_SCHEME,
  absolutePathFromMediaStreamUrl,
  buildMediaStreamUrl,
} from '../../shared/mediaStreamUrl'

export { MEDIA_STREAM_SCHEME, absolutePathFromMediaStreamUrl, buildMediaStreamUrl }

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
