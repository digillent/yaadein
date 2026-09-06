import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import {
  buildCandidateFileName,
  destinationDirectory,
  destinationFilePath,
  formatYearMonth,
  sanitizeFileName,
} from './paths'

describe('workingFolder paths', () => {
  it('formats UTC year/month segments', () => {
    expect(formatYearMonth(new Date('2026-09-05T12:00:00.000Z'))).toBe('2026/09')
    expect(formatYearMonth(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026/01')
  })

  it('builds destination directories under the bucket', () => {
    const root = join('/tmp', 'Yaadein')
    expect(destinationDirectory(root, 'preserve', new Date('2026-09-05T12:00:00.000Z'))).toBe(
      join(root, 'preserve', '2026', '09'),
    )
  })

  it('sanitizes to basename only', () => {
    expect(sanitizeFileName(join('/a', 'b', 'IMG_1.jpg'))).toBe('IMG_1.jpg')
  })

  it('uses original name first, then disambiguator on collision attempts', () => {
    expect(buildCandidateFileName('IMG_1.jpg')).toBe('IMG_1.jpg')
    expect(buildCandidateFileName('IMG_1.jpg', 'abc12345', 0)).toBe('IMG_1.jpg')
    expect(buildCandidateFileName('IMG_1.jpg', 'abc12345', 1)).toBe('IMG_1_abc12345.jpg')
    expect(buildCandidateFileName('IMG_1.jpg', undefined, 1)).toBe('IMG_1_1.jpg')
  })

  it('builds a full destination file path', () => {
    const root = join('/tmp', 'Yaadein')
    expect(
      destinationFilePath(
        root,
        'rejected',
        new Date('2026-07-18T00:00:00.000Z'),
        'vacation.png',
        undefined,
        0,
      ),
    ).toBe(join(root, 'rejected', '2026', '07', 'vacation.png'))
  })
})
