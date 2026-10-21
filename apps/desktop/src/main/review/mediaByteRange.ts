export type ByteRangeHeader =
  | { kind: 'absent' }
  | { kind: 'partial'; start: number; end: number }
  | { kind: 'unsatisfiable' }

export type MediaByteRangePlan = {
  status: 200 | 206 | 416
  start: number
  end: number
  headers: Record<string, string>
}

/** Parse a single `Range: bytes=` header. Malformed values fall back to the full file. */
export function parseByteRangeHeader(header: string | null, size: number): ByteRangeHeader {
  if (header == null || header.trim() === '') {
    return { kind: 'absent' }
  }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (!match) {
    return { kind: 'absent' }
  }
  const startRaw = match[1] ?? ''
  const endRaw = match[2] ?? ''
  if (startRaw === '' && endRaw === '') {
    return { kind: 'absent' }
  }
  if (size <= 0) {
    return { kind: 'unsatisfiable' }
  }
  if (startRaw === '') {
    const suffix = Number(endRaw)
    if (!Number.isInteger(suffix) || suffix <= 0) {
      return { kind: 'unsatisfiable' }
    }
    return { kind: 'partial', start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(startRaw)
  if (!Number.isInteger(start) || start < 0 || start >= size) {
    return { kind: 'unsatisfiable' }
  }
  const end = endRaw === '' ? size - 1 : Number(endRaw)
  if (!Number.isInteger(end) || end < start) {
    return { kind: 'unsatisfiable' }
  }
  return { kind: 'partial', start, end: Math.min(end, size - 1) }
}

/** Status, bounds, and headers for a local media response the video element can seek. */
export function planMediaByteRange(options: {
  size: number
  rangeHeader: string | null
  mediaType: string
}): MediaByteRangePlan {
  const range = parseByteRangeHeader(options.rangeHeader, options.size)
  const headers: Record<string, string> = {
    'Content-Type': options.mediaType,
    'Accept-Ranges': 'bytes',
  }
  if (range.kind === 'unsatisfiable') {
    headers['Content-Range'] = `bytes */${Math.max(0, options.size)}`
    return { status: 416, start: 0, end: -1, headers }
  }
  if (options.size <= 0 || range.kind === 'absent') {
    headers['Content-Length'] = String(Math.max(0, options.size))
    return {
      status: 200,
      start: 0,
      end: Math.max(0, options.size) - 1,
      headers,
    }
  }
  const length = range.end - range.start + 1
  headers['Content-Length'] = String(length)
  headers['Content-Range'] = `bytes ${range.start}-${range.end}/${options.size}`
  return { status: 206, start: range.start, end: range.end, headers }
}
