import { describe, expect, it } from 'vitest'
import { parseByteRangeHeader, planMediaByteRange } from './mediaByteRange'

describe('parseByteRangeHeader', () => {
  it('treats a missing header as the full file', () => {
    expect(parseByteRangeHeader(null, 1000)).toEqual({ kind: 'absent' })
  })

  it('parses open, closed, and suffix ranges', () => {
    expect(parseByteRangeHeader('bytes=0-', 1000)).toEqual({
      kind: 'partial',
      start: 0,
      end: 999,
    })
    expect(parseByteRangeHeader('bytes=100-199', 1000)).toEqual({
      kind: 'partial',
      start: 100,
      end: 199,
    })
    expect(parseByteRangeHeader('bytes=-50', 1000)).toEqual({
      kind: 'partial',
      start: 950,
      end: 999,
    })
  })

  it('clamps an end past the file and rejects a start past the end', () => {
    expect(parseByteRangeHeader('bytes=10-5000', 100)).toEqual({
      kind: 'partial',
      start: 10,
      end: 99,
    })
    expect(parseByteRangeHeader('bytes=1000-', 100)).toEqual({ kind: 'unsatisfiable' })
  })
})

describe('planMediaByteRange', () => {
  it('returns 200 with Accept-Ranges when no range is requested', () => {
    const plan = planMediaByteRange({
      size: 80,
      rangeHeader: null,
      mediaType: 'video/mp4',
    })
    expect(plan.status).toBe(200)
    expect(plan.headers['Accept-Ranges']).toBe('bytes')
    expect(plan.headers['Content-Length']).toBe('80')
    expect(plan.headers['Content-Type']).toBe('video/mp4')
    expect(plan.start).toBe(0)
    expect(plan.end).toBe(79)
  })

  it('returns 206 for a seek range', () => {
    const plan = planMediaByteRange({
      size: 1000,
      rangeHeader: 'bytes=100-149',
      mediaType: 'video/mp4',
    })
    expect(plan.status).toBe(206)
    expect(plan.start).toBe(100)
    expect(plan.end).toBe(149)
    expect(plan.headers['Content-Length']).toBe('50')
    expect(plan.headers['Content-Range']).toBe('bytes 100-149/1000')
  })

  it('returns 416 when the range starts past the file', () => {
    const plan = planMediaByteRange({
      size: 10,
      rangeHeader: 'bytes=20-',
      mediaType: 'video/mp4',
    })
    expect(plan.status).toBe(416)
    expect(plan.headers['Content-Range']).toBe('bytes */10')
  })
})
