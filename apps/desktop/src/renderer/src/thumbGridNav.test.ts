import { describe, expect, it } from 'vitest'
import { columnCountFromTemplate, gridNeighborIndex } from './thumbGridNav'

describe('gridNeighborIndex', () => {
  // 3 columns, 5 items:
  // 0 1 2
  // 3 4
  it('moves to a neighbor and stops at an empty edge', () => {
    expect(gridNeighborIndex(0, 5, 3, 'left')).toBeNull()
    expect(gridNeighborIndex(0, 5, 3, 'right')).toBe(1)
    expect(gridNeighborIndex(2, 5, 3, 'right')).toBeNull()
    expect(gridNeighborIndex(1, 5, 3, 'down')).toBe(4)
    expect(gridNeighborIndex(2, 5, 3, 'down')).toBeNull()
    expect(gridNeighborIndex(4, 5, 3, 'up')).toBe(1)
    expect(gridNeighborIndex(3, 5, 3, 'up')).toBe(0)
    expect(gridNeighborIndex(0, 5, 3, 'up')).toBeNull()
  })
})

describe('columnCountFromTemplate', () => {
  it('counts resolved column tracks', () => {
    expect(columnCountFromTemplate('176px 176px 180px')).toBe(3)
    expect(columnCountFromTemplate('none')).toBe(1)
  })
})
