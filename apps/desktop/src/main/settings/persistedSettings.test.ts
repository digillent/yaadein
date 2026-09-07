import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  filterExistingRoots,
  loadPersistedSettings,
  savePersistedSettings,
  settingsFilePath,
} from './persistedSettings'

describe('persistedSettings', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('round-trips workingRoot and scanRoot under userData', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'yaadein-settings-'))
    dirs.push(userData)
    const work = mkdtempSync(join(tmpdir(), 'yaadein-work-'))
    dirs.push(work)

    await savePersistedSettings(userData, { workingRoot: work, scanRoot: work })
    const loaded = await loadPersistedSettings(userData)
    expect(loaded).toEqual({ workingRoot: work, scanRoot: work })
    expect(settingsFilePath(userData)).toContain('desktop-settings.json')
  })

  it('drops roots that no longer exist on disk', () => {
    expect(
      filterExistingRoots({
        workingRoot: join(tmpdir(), 'yaadein-missing-work-xyz'),
        scanRoot: '',
      }),
    ).toEqual({ workingRoot: '', scanRoot: '' })
  })

  it('merges patch without wiping the other root', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'yaadein-settings-'))
    dirs.push(userData)
    const work = mkdtempSync(join(tmpdir(), 'yaadein-work-'))
    const scan = mkdtempSync(join(tmpdir(), 'yaadein-scan-'))
    dirs.push(work, scan)

    await savePersistedSettings(userData, { workingRoot: work })
    await savePersistedSettings(userData, { scanRoot: scan })
    expect(await loadPersistedSettings(userData)).toEqual({
      workingRoot: work,
      scanRoot: scan,
    })
  })

  it('tolerates corrupt settings file', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'yaadein-settings-'))
    dirs.push(userData)
    mkdirSync(userData, { recursive: true })
    writeFileSync(settingsFilePath(userData), '{not-json', 'utf8')
    expect(await loadPersistedSettings(userData)).toEqual({ workingRoot: '', scanRoot: '' })
  })
})
