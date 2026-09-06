import { appName } from '../shared/appInfo'

export interface YaadeinApi {
  appName: typeof appName
}

declare global {
  interface Window {
    yaadein: YaadeinApi
  }
}

export {}
