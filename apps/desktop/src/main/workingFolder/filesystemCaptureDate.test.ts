import { describe, expect, it } from 'vitest'
import type { Stats } from 'node:fs'
import { captureDateFromStats, filesystemTimestamps } from './filesystemCaptureDate'

function statsWith(partial: Partial<Stats>): Stats {
  return partial as Stats
}

describe('filesystemCaptureDate', () => {
  it('collects usable timestamps and ignores epoch placeholders', () => {
    const mtime = new Date('2024-03-10T12:00:00.000Z')
    const birthtime = new Date('2020-01-01T00:00:00.000Z')
    const times = filesystemTimestamps(
      statsWith({
        mtime,
        birthtime,
        ctime: new Date(0),
        atime: new Date('2025-01-01T00:00:00.000Z'),
      }),
    )
    expect(times.map((d) => d.toISOString())).toEqual([
      mtime.toISOString(),
      birthtime.toISOString(),
      '2025-01-01T00:00:00.000Z',
    ])
  })

  it('uses the oldest usable filesystem time (created vs modified vs others)', () => {
    const oldest = new Date('2019-05-01T00:00:00.000Z')
    const date = captureDateFromStats(
      statsWith({
        mtime: new Date('2024-03-10T12:00:00.000Z'),
        birthtime: oldest,
        ctime: new Date('2021-01-01T00:00:00.000Z'),
        atime: new Date('2025-06-01T00:00:00.000Z'),
      }),
    )
    expect(date.toISOString()).toBe(oldest.toISOString())
  })

  it('falls back to whatever usable time remains', () => {
    const ctime = new Date('2021-11-02T00:00:00.000Z')
    const date = captureDateFromStats(
      statsWith({
        mtime: new Date(0),
        birthtime: new Date(0),
        ctime,
        atime: new Date(0),
      }),
    )
    expect(date.toISOString()).toBe(ctime.toISOString())
  })
})
