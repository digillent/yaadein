import { describe, expect, it } from 'vitest'
import {
  collectTagFilters,
  emptyMediaTags,
  matchesAllTagFilters,
  tagFilterKey,
} from './tagFilter'

describe('tagFilter', () => {
  it('matches all when no filters selected', () => {
    expect(matchesAllTagFilters(emptyMediaTags(), [])).toBe(true)
  })

  it('requires every selected tag (AND)', () => {
    const tags = {
      people: ['Aaryan'],
      places: ['Yellowstone'],
      events: ['Summer'],
    }
    expect(
      matchesAllTagFilters(tags, [
        { dimension: 'people', value: 'Aaryan' },
        { dimension: 'places', value: 'Yellowstone' },
      ]),
    ).toBe(true)
    expect(
      matchesAllTagFilters(tags, [
        { dimension: 'people', value: 'Aaryan' },
        { dimension: 'places', value: 'Paris' },
      ]),
    ).toBe(false)
  })

  it('collects unique filters sorted by dimension', () => {
    const filters = collectTagFilters([
      { tags: { people: ['B', 'A'], places: [], events: ['Trip'] } },
      { tags: { people: ['A'], places: ['Home'], events: [] } },
    ])
    expect(filters.map(tagFilterKey)).toEqual([
      'events:Trip',
      'people:A',
      'people:B',
      'places:Home',
    ])
  })
})
