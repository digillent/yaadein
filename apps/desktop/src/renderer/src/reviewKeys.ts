/** Map keyboard arrows to Tinder-style review actions. */
export type ReviewKeyAction = 'prev' | 'next' | 'accept' | 'reject'

export function reviewActionFromKey(key: string): ReviewKeyAction | null {
  switch (key) {
    case 'ArrowLeft':
      return 'prev'
    case 'ArrowRight':
      return 'next'
    case 'ArrowUp':
      return 'accept'
    case 'ArrowDown':
      return 'reject'
    default:
      return null
  }
}
