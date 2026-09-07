import { existsSync, statSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PersistedDesktopSettings } from '../../shared/persistedSettingsTypes'

const SETTINGS_FILE = 'desktop-settings.json'

export function settingsFilePath(userDataPath: string): string {
  return join(userDataPath, SETTINGS_FILE)
}

function emptySettings(): PersistedDesktopSettings {
  return { workingRoot: '', scanRoot: '' }
}

function isExistingDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory()
  } catch {
    return false
  }
}

function normalize(raw: unknown): PersistedDesktopSettings {
  if (!raw || typeof raw !== 'object') {
    return emptySettings()
  }
  const record = raw as Record<string, unknown>
  return {
    workingRoot: typeof record.workingRoot === 'string' ? record.workingRoot.trim() : '',
    scanRoot: typeof record.scanRoot === 'string' ? record.scanRoot.trim() : '',
  }
}

async function readRawSettings(userDataPath: string): Promise<PersistedDesktopSettings> {
  const path = settingsFilePath(userDataPath)
  if (!existsSync(path)) {
    return emptySettings()
  }
  try {
    return normalize(JSON.parse(await readFile(path, 'utf8')))
  } catch {
    return emptySettings()
  }
}

/** Keep only roots that still exist as directories (avoid stale packaged-app paths). */
export function filterExistingRoots(settings: PersistedDesktopSettings): PersistedDesktopSettings {
  return {
    workingRoot: settings.workingRoot && isExistingDirectory(settings.workingRoot)
      ? settings.workingRoot
      : '',
    scanRoot:
      settings.scanRoot && isExistingDirectory(settings.scanRoot) ? settings.scanRoot : '',
  }
}

export async function loadPersistedSettings(
  userDataPath: string,
): Promise<PersistedDesktopSettings> {
  return filterExistingRoots(await readRawSettings(userDataPath))
}

export async function savePersistedSettings(
  userDataPath: string,
  patch: Partial<PersistedDesktopSettings>,
): Promise<PersistedDesktopSettings> {
  const base = await readRawSettings(userDataPath)
  const next: PersistedDesktopSettings = {
    workingRoot:
      patch.workingRoot !== undefined ? patch.workingRoot.trim() : base.workingRoot,
    scanRoot: patch.scanRoot !== undefined ? patch.scanRoot.trim() : base.scanRoot,
  }

  await mkdir(userDataPath, { recursive: true })
  await writeFile(settingsFilePath(userDataPath), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}
