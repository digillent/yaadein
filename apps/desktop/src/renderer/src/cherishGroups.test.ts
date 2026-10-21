import { describe, expect, it } from 'vitest'
import {
  adjacentInOrder,
  cursorForDecade,
  cursorForYear,
  decadeKey,
  defaultBrowseCursor,
  flattenYearMonthGroups,
  groupByDecade,
  groupByYearMonth,
  monthLabel,
} from './cherishGroups'

const files = [
  { absolutePath: '/a', yearMonth: '2024/03' },
  { absolutePath: '/b', yearMonth: '2026/01' },
  { absolutePath: '/c', yearMonth: '2026/11' },
  { absolutePath: '/d', yearMonth: null },
  { absolutePath: '/e', yearMonth: '2026/11' },
]

describe('groupByYearMonth', () => {
  it('groups newest year and month first and keeps undated last', () => {
    const groups = groupByYearMonth(files)
    expect(groups.map((group) => group.year)).toEqual(['2026', '2024', 'Undated'])
    expect(groups[0]?.months.map((month) => month.monthLabel)).toEqual(['November', 'January'])
    expect(groups[0]?.months[0]?.items.map((item) => item.absolutePath)).toEqual(['/c', '/e'])
    expect(monthLabel('2026/01')).toBe('January')
  })

  it('flattens in the same browse order', () => {
    const ordered = flattenYearMonthGroups(groupByYearMonth(files))
    expect(ordered.map((item) => item.absolutePath)).toEqual(['/c', '/e', '/b', '/a', '/d'])
  })
})

describe('groupByDecade', () => {
  it('collapses years into decades, newest first', () => {
    const decades = groupByDecade(
      groupByYearMonth([
        ...files,
        { absolutePath: '/old', yearMonth: '1998/07' },
      ]),
    )
    expect(decades.map((decade) => decade.decade)).toEqual(['2020s', '1990s', 'Undated'])
    expect(decadeKey('1998')).toBe('1990s')
    expect(defaultBrowseCursor(decades)).toEqual({
      decade: '2020s',
      year: '2026',
      yearMonth: '2026/11',
    })
    expect(cursorForDecade(decades, '1990s')).toEqual({
      decade: '1990s',
      year: '1998',
      yearMonth: '1998/07',
    })
    expect(cursorForYear(decades, '2024')?.yearMonth).toBe('2024/03')
  })
})

describe('adjacentInOrder', () => {
  const ordered = flattenYearMonthGroups(groupByYearMonth(files))

  it('steps to the neighbor and stops at the ends', () => {
    expect(adjacentInOrder(ordered, '/c', 'next')?.absolutePath).toBe('/e')
    expect(adjacentInOrder(ordered, '/c', 'prev')).toBeNull()
    expect(adjacentInOrder(ordered, '/d', 'next')).toBeNull()
    expect(adjacentInOrder(ordered, '/missing', 'next')).toBeNull()
  })
})
