import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Candidate paths for apps/desktop/.env during local `pnpm dev`.
 * Packaged builds embed public config at compile time — no runtime .env copy.
 */
export function desktopEnvCandidatePaths(options: {
  cwd: string
  moduleDir: string
}): string[] {
  return [join(options.cwd, '.env'), join(options.moduleDir, '../../../.env')]
}

/**
 * Load the first existing .env into process.env (does not override existing vars).
 * Used for local development; packaged apps use build-time Vite env instead.
 */
export function loadDesktopEnvFile(): void {
  const candidates = desktopEnvCandidatePaths({
    cwd: process.cwd(),
    moduleDir: dirname(fileURLToPath(import.meta.url)),
  })

  for (const envPath of candidates) {
    if (!existsSync(envPath)) {
      continue
    }
    for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) {
        continue
      }
      const eq = line.indexOf('=')
      if (eq <= 0) {
        continue
      }
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
    return
  }
}
