import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Load apps/desktop/.env into process.env (does not override existing vars).
 * Keeps Entra IDs out of git while making them available to the main process.
 */
export function loadDesktopEnvFile(): void {
  const candidates = [
    join(process.cwd(), '.env'),
    join(dirname(fileURLToPath(import.meta.url)), '../../../.env'),
  ]

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
