import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { dedupeCherishByContentHash, listCherishMedia } from './listCherishMedia'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

describe('dedupeCherishByContentHash', () => {
  it('keeps one entry per hash and lists extras', () => {
    const hash = 'abc'
    const deduped = dedupeCherishByContentHash([
      {
        absolutePath: '/w/preserve/2026/01/b.jpg',
        relativePath: '2026/01/b.jpg',
        contentHash: hash,
        fileSize: 3,
        yearMonth: '2026/01',
        tags: { people: [], places: [], events: [] },
        hasCosmosAccepted: false,
        originalFilename: 'b.jpg',
      },
      {
        absolutePath: '/w/preserve/2026/01/a.jpg',
        relativePath: '2026/01/a.jpg',
        contentHash: hash,
        fileSize: 3,
        yearMonth: '2026/01',
        tags: { people: ['A'], places: [], events: [] },
        hasCosmosAccepted: true,
        originalFilename: 'a.jpg',
      },
    ])
    expect(deduped).toHaveLength(1)
    expect(deduped[0]?.relativePath).toBe('2026/01/a.jpg')
    expect(deduped[0]?.localCopyCount).toBe(2)
    expect(deduped[0]?.extraLocalPaths).toEqual(['2026/01/b.jpg'])
  })
})

describe('listCherishMedia', () => {
  it('lists preserve files and attaches Cosms ACCEPTED tags', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-cherish-'))
    mkdirSync(join(work, 'preserve', '2026', '03'), { recursive: true })
    const body = 'cherish-bytes'
    const hash = sha256(body)
    const path = join(work, 'preserve', '2026', '03', 'keep.jpg')
    writeFileSync(path, body)
    writeFileSync(join(work, 'preserve', '2026', '03', '.DS_Store'), 'junk')

    const doc: MediaDecisionDocument = {
      id: hash,
      userId: 'oid-1',
      contentHash: hash,
      fileSize: Buffer.byteLength(body),
      decision: 'ACCEPTED',
      decidedAt: new Date().toISOString(),
      cloudStatus: 'SYNCED',
      originalFilename: 'keep.jpg',
      tags: { people: ['Aaryan'], places: ['Home'], events: [] },
    }

    const result = await listCherishMedia(work, {
      decisions: {
        async listAcceptedSynced() {
          return [doc]
        },
      },
    })

    expect(result.tagsFromCosmos).toBe(true)
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toMatchObject({
      absolutePath: path,
      contentHash: hash,
      hasCosmosAccepted: true,
      localCopyCount: 1,
      extraLocalPaths: [],
      tags: { people: ['Aaryan'], places: ['Home'], events: [] },
    })
    expect(result.files[0]?.relativePath.replace(/\\/g, '/')).toBe('2026/03/keep.jpg')
  })

  it('collapses same-hash local copies to one tile', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-cherish-'))
    mkdirSync(join(work, 'preserve', '2026', '01'), { recursive: true })
    mkdirSync(join(work, 'preserve', '2025', '12'), { recursive: true })
    const body = 'same-bytes-xx'
    writeFileSync(join(work, 'preserve', '2026', '01', 'copy-a.jpg'), body)
    writeFileSync(join(work, 'preserve', '2025', '12', 'copy-b.jpg'), body)

    const result = await listCherishMedia(work, {})
    expect(result.files).toHaveLength(1)
    expect(result.files[0]?.localCopyCount).toBe(2)
    expect(result.files[0]?.extraLocalPaths).toHaveLength(1)
  })

  it('lists preserve without Cosms when decisions omitted', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-cherish-'))
    mkdirSync(join(work, 'preserve', '2025', '01'), { recursive: true })
    writeFileSync(join(work, 'preserve', '2025', '01', 'a.jpg'), 'x')
    const result = await listCherishMedia(work, {})
    expect(result.tagsFromCosmos).toBe(false)
    expect(result.files).toHaveLength(1)
    expect(result.files[0]?.hasCosmosAccepted).toBe(false)
    expect(result.files[0]?.tags).toEqual({ people: [], places: [], events: [] })
  })
})
