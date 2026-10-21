export type ThumbArrow = 'left' | 'right' | 'up' | 'down'

export function thumbArrowFromKey(key: string): ThumbArrow | null {
  switch (key) {
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    default:
      return null
  }
}

/** Count of tracks in a computed `grid-template-columns` value. */
export function columnCountFromTemplate(template: string | null | undefined): number {
  if (!template || template === 'none') {
    return 1
  }
  const parts = template.trim().split(/\s+/).filter(Boolean)
  return Math.max(1, parts.length)
}

/**
 * Next index in a uniform grid. Returns null at an edge or an empty cell
 * (for example the last row has no item in that column).
 */
export function gridNeighborIndex(
  index: number,
  count: number,
  columns: number,
  direction: ThumbArrow,
): number | null {
  if (count <= 0 || index < 0 || index >= count) {
    return null
  }
  const cols = Math.max(1, Math.floor(columns))
  const col = index % cols
  if (direction === 'left') {
    return col === 0 ? null : index - 1
  }
  if (direction === 'right') {
    if (col >= cols - 1 || index + 1 >= count) {
      return null
    }
    return index + 1
  }
  if (direction === 'up') {
    return index - cols >= 0 ? index - cols : null
  }
  const below = index + cols
  return below < count ? below : null
}
