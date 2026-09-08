import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isJunkFileName,
  pruneEmptyAncestors,
  pruneEmptyDirTree,
  removeDirIfEmptyOrJunkOnly,
} from './pruneEmptyDirs'

describe('isJunkFileName', () => {
  it('recognizes common system clutter', () => {
    expect(isJunkFileName('.DS_Store')).toBe(true)
    expect(isJunkFileName('Thumbs.db')).toBe(true)
    expect(isJunkFileName('desktop.ini')).toBe(true)
    expect(isJunkFileName('photo.jpg')).toBe(false)
  })
})

describe('pruneEmptyDirTree', () => {
  it('removes nested empty dirs and junk-only dirs but keeps the root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-prune-'))
    const nested = join(root, 'album', 'day')
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, '.DS_Store'), 'mac')
    writeFileSync(join(root, 'album', 'Thumbs.db'), 'win')
    writeFileSync(join(root, '.DS_Store'), 'root-junk')

    await pruneEmptyDirTree(root, { removeRoot: false })

    expect(existsSync(root)).toBe(true)
    expect(existsSync(join(root, 'album'))).toBe(false)
    expect(readdirSync(root)).toEqual([])
  })

  it('keeps folders that still have real files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-prune-keep-'))
    const nested = join(root, 'keep')
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, 'a.jpg'), 'photo')
    writeFileSync(join(nested, '.DS_Store'), 'mac')

    await pruneEmptyDirTree(root, { removeRoot: false })

    expect(existsSync(join(nested, 'a.jpg'))).toBe(true)
    expect(existsSync(join(nested, '.DS_Store'))).toBe(true)
  })
})

describe('pruneEmptyAncestors', () => {
  it('walks up inside a boundary root but never deletes the boundary', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-prune-anc-'))
    const day = join(root, 'trip', 'day')
    mkdirSync(day, { recursive: true })
    writeFileSync(join(day, '.DS_Store'), 'x')

    await pruneEmptyAncestors(day, [root])

    expect(existsSync(root)).toBe(true)
    expect(existsSync(join(root, 'trip'))).toBe(false)
  })

  it('does not delete folders outside the boundary', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-prune-out-'))
    const outside = join(root, 'outside')
    mkdirSync(outside, { recursive: true })
    writeFileSync(join(outside, '.DS_Store'), 'x')
    const boundary = join(root, 'inside')
    mkdirSync(boundary, { recursive: true })

    await pruneEmptyAncestors(outside, [boundary])

    expect(existsSync(outside)).toBe(true)
  })

  it('removeDirIfEmptyOrJunkOnly leaves dirs with children', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-prune-one-'))
    mkdirSync(join(root, 'child'))
    expect(await removeDirIfEmptyOrJunkOnly(root)).toBe(false)
  })
})
