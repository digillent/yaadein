import type { MediaTags } from './mediaTypes'
import type { TagDimension, TagFilter } from './cherishTypes'

export function emptyMediaTags(): MediaTags {
  return { people: [], places: [], events: [] }
}

export function tagFilterKey(filter: TagFilter): string {
  return `${filter.dimension}:${filter.value}`
}

/** Collect unique tag filters from entries, sorted by dimension then value. */
export function collectTagFilters(entries: Array<{ tags: MediaTags }>): TagFilter[] {
  const seen = new Set<string>()
  const filters: TagFilter[] = []
  const dimensions: TagDimension[] = ['people', 'places', 'events']
  for (const dimension of dimensions) {
    for (const entry of entries) {
      for (const value of entry.tags[dimension]) {
        const trimmed = value.trim()
        if (!trimmed) {
          continue
        }
        const key = `${dimension}:${trimmed}`
        if (seen.has(key)) {
          continue
        }
        seen.add(key)
        filters.push({ dimension, value: trimmed })
      }
    }
  }
  return filters.sort((a, b) => {
    if (a.dimension !== b.dimension) {
      return a.dimension.localeCompare(b.dimension)
    }
    return a.value.localeCompare(b.value)
  })
}

/**
 * AND semantics: every selected tag must appear on the media.
 * Empty selection matches all.
 */
export function matchesAllTagFilters(tags: MediaTags, selected: TagFilter[]): boolean {
  if (selected.length === 0) {
    return true
  }
  return selected.every((filter) =>
    tags[filter.dimension].some((value) => value === filter.value),
  )
}
