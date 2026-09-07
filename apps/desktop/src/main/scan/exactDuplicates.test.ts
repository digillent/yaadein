import { describe, expect, it } from 'vitest'
import {
  classifyExactDuplicate,
  groupByFileSize,
  peerCandidateSizes,
} from './exactDuplicates'

describe('exactDuplicates', () => {
  it('groups by size and marks multi-file sizes as peer candidates', () => {
    const files = [
      { sourcePath: '/a.jpg', fileSize: 10 },
      { sourcePath: '/b.jpg', fileSize: 10 },
      { sourcePath: '/c.jpg', fileSize: 20 },
    ]
    const groups = groupByFileSize(files)
    expect(groups.get(10)).toHaveLength(2)
    expect(groups.get(20)).toHaveLength(1)
    expect([...peerCandidateSizes(files)]).toEqual([10])
  })

  it('treats Cosms ACCEPTED hash as duplicate and REJECTED as rejected', () => {
    expect(
      classifyExactDuplicate({
        contentHash: 'h1',
        cosmosDecision: 'ACCEPTED',
        seenHashes: new Set(),
      }),
    ).toEqual({ kind: 'duplicate', reason: 'cosmos_accepted' })

    expect(
      classifyExactDuplicate({
        contentHash: 'h1',
        cosmosDecision: 'REJECTED',
        seenHashes: new Set(),
      }),
    ).toEqual({ kind: 'rejected' })
  })

  it('marks later same-hash peers as scan_peer duplicates; first stays unknown', () => {
    const first = classifyExactDuplicate({
      contentHash: 'same',
      cosmosDecision: undefined,
      seenHashes: new Set(),
    })
    expect(first).toEqual({ kind: 'unknown' })

    const second = classifyExactDuplicate({
      contentHash: 'same',
      cosmosDecision: undefined,
      seenHashes: new Set(['same']),
    })
    expect(second).toEqual({ kind: 'duplicate', reason: 'scan_peer' })
  })

  it('does not treat size-only overlap as duplicate without hash/seen', () => {
    // Two files can share a size; without matching hash/seen they stay unknown.
    expect(
      classifyExactDuplicate({
        contentHash: 'unique-a',
        cosmosDecision: undefined,
        seenHashes: new Set(['unique-b']),
      }),
    ).toEqual({ kind: 'unknown' })
  })
})
