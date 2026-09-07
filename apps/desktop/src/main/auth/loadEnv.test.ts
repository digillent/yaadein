import { describe, expect, it } from 'vitest'
import { desktopEnvCandidatePaths } from './loadEnv'

describe('desktopEnvCandidatePaths', () => {
  it('includes cwd then module-relative desktop root', () => {
    const paths = desktopEnvCandidatePaths({
      cwd: '/tmp/cwd',
      moduleDir: '/app/apps/desktop/src/main/auth',
    })

    expect(paths).toEqual(['/tmp/cwd/.env', '/app/apps/desktop/.env'])
  })
})
