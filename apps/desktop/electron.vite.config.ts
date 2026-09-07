import { loadEnv, type Plugin } from 'vite'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const REQUIRED_FOR_PACKAGE = [
  'YAADEIN_ENTRA_CLIENT_ID',
  'YAADEIN_ENTRA_TENANT_ID',
  'YAADEIN_COSMOS_ENDPOINT',
  'YAADEIN_BLOB_ACCOUNT_URL',
] as const

/** Fail `electron-vite build` early when packaged config would be incomplete. */
function assertPublicEnvForBuild(env: Record<string, string>): Plugin {
  return {
    name: 'yaadein-assert-public-env',
    buildStart() {
      const missing = REQUIRED_FOR_PACKAGE.filter((key) => !env[key]?.trim())
      if (missing.length > 0) {
        throw new Error(
          `Missing ${missing.join(', ')} in apps/desktop/.env. Copy .env.example → .env before pnpm dist / build.`,
        )
      }
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, resolve(__dirname), '')
  const envPrefix = 'YAADEIN_'

  return {
    main: {
      envPrefix,
      plugins: [
        externalizeDepsPlugin(),
        ...(command === 'build' ? [assertPublicEnvForBuild(env)] : []),
      ],
    },
    preload: {
      envPrefix,
      plugins: [externalizeDepsPlugin()],
    },
    renderer: {
      envPrefix,
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src'),
          '@shared': resolve('src/shared'),
        },
      },
      plugins: [react()],
    },
  }
})
