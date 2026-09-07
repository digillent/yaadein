import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { listCherishMedia } from './listCherishMedia'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

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
      tags: { people: ['Aaryan'], places: ['Home'], events: [] },
    })
    expect(result.files[0]?.relativePath.replace(/\\/g, '/')).toBe('2026/03/keep.jpg')
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
