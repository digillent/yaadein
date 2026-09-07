/** Keyboard actions for duplicate compare review. */
export type DuplicateKeyAction = 'prev' | 'next' | 'delete'

export function duplicateActionFromKey(key: string): DuplicateKeyAction | null {
  switch (key) {
    case 'ArrowLeft':
      return 'prev'
    case 'ArrowRight':
      return 'next'
    case 'ArrowDown':
      return 'delete'
    default:
      return null
  }
}
