import type { YaadeinApi } from './index'

declare global {
  interface Window {
    yaadein: YaadeinApi
  }
}

export {}
