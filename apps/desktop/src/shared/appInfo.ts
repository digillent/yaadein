/** App identity helpers shared by main, preload, and tests (Milestone 1 smoke surface). */
export const appName = 'Yaadein' as const

export function getShellTitle(): string {
  return appName
}
