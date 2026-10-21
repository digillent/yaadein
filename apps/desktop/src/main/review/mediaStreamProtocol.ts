import { protocol } from 'electron'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { isMediaPath, mediaTypeFromPath } from '../media/mediaType'
import { planMediaByteRange } from './mediaByteRange'
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

/**
 * Register after app.whenReady(). Serves local media for img/video.
 * Byte ranges are required: without 206 responses the video element cannot seek
 * and large files stall while the whole file downloads.
 */
export function registerMediaStreamProtocol(): void {
  protocol.handle(MEDIA_STREAM_SCHEME, (request) => {
    const filePath = absolutePathFromMediaStreamUrl(request.url)
    if (!filePath || !existsSync(filePath) || !isMediaPath(filePath)) {
      return new Response('Not found', { status: 404 })
    }
    const size = statSync(filePath).size
    const plan = planMediaByteRange({
      size,
      rangeHeader: request.headers.get('range'),
      mediaType: mediaTypeFromPath(filePath),
    })
    if (plan.status === 416 || plan.end < plan.start) {
      return new Response(null, { status: plan.status === 416 ? 416 : 200, headers: plan.headers })
    }
    const nodeStream = createReadStream(filePath, { start: plan.start, end: plan.end })
    const abort = (): void => {
      nodeStream.destroy()
    }
    if (request.signal.aborted) {
      abort()
    } else {
      request.signal.addEventListener('abort', abort, { once: true })
    }
    return new Response(Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, {
      status: plan.status,
      headers: plan.headers,
    })
  })
}
