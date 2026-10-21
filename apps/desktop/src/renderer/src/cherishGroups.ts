const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export type YearMonthItem = {
  yearMonth: string | null
}

export type MonthGroup<T extends YearMonthItem> = {
  yearMonth: string | null
  year: string
  monthLabel: string
  items: T[]
}

export type YearGroup<T extends YearMonthItem> = {
  year: string
  months: MonthGroup<T>[]
}

export function yearLabel(yearMonth: string | null): string {
  return yearMonth ? yearMonth.slice(0, 4) : 'Undated'
}

export function monthLabel(yearMonth: string | null): string {
  if (!yearMonth) {
    return 'Undated'
  }
  const month = Number(yearMonth.slice(5, 7))
  return MONTH_NAMES[month - 1] ?? yearMonth.slice(5, 7)
}

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export function shortMonthLabel(yearMonth: string | null): string {
  if (!yearMonth) {
    return 'Undated'
  }
  const month = Number(yearMonth.slice(5, 7))
  return SHORT_MONTH_NAMES[month - 1] ?? yearMonth.slice(5, 7)
}

/** `2026` → `2020s`. Undated stays undated. */
export function decadeKey(year: string): string {
  if (year === 'Undated') {
    return 'Undated'
  }
  const parsed = Number(year)
  if (!Number.isInteger(parsed)) {
    return 'Undated'
  }
  return `${Math.floor(parsed / 10) * 10}s`
}

export type DecadeGroup<T extends YearMonthItem> = {
  decade: string
  years: YearGroup<T>[]
}

export type BrowseCursor = {
  decade: string
  year: string
  yearMonth: string | null
}

export function groupByDecade<T extends YearMonthItem>(years: YearGroup<T>[]): DecadeGroup<T>[] {
  const byDecade = new Map<string, YearGroup<T>[]>()
  for (const year of years) {
    const key = decadeKey(year.year)
    const bucket = byDecade.get(key)
    if (bucket) {
      bucket.push(year)
    } else {
      byDecade.set(key, [year])
    }
  }
  const keys = [...byDecade.keys()].sort((a, b) => {
    if (a === 'Undated') {
      return 1
    }
    if (b === 'Undated') {
      return -1
    }
    return b.localeCompare(a)
  })
  return keys.map((decade) => ({ decade, years: byDecade.get(decade)! }))
}

export function defaultBrowseCursor<T extends YearMonthItem>(
  decades: DecadeGroup<T>[],
): BrowseCursor | null {
  const decade = decades[0]
  const year = decade?.years[0]
  const month = year?.months[0]
  if (!decade || !year || !month) {
    return null
  }
  return { decade: decade.decade, year: year.year, yearMonth: month.yearMonth }
}

export function cursorForYearMonth<T extends YearMonthItem>(
  decades: DecadeGroup<T>[],
  yearMonth: string | null,
): BrowseCursor | null {
  for (const decade of decades) {
    for (const year of decade.years) {
      for (const month of year.months) {
        if ((month.yearMonth ?? null) === yearMonth) {
          return { decade: decade.decade, year: year.year, yearMonth: month.yearMonth }
        }
      }
    }
  }
  return null
}

export function cursorForDecade<T extends YearMonthItem>(
  decades: DecadeGroup<T>[],
  decadeKeyValue: string,
): BrowseCursor | null {
  const decade = decades.find((item) => item.decade === decadeKeyValue)
  const year = decade?.years[0]
  const month = year?.months[0]
  if (!decade || !year || !month) {
    return null
  }
  return { decade: decade.decade, year: year.year, yearMonth: month.yearMonth }
}

export function cursorForYear<T extends YearMonthItem>(
  decades: DecadeGroup<T>[],
  yearValue: string,
): BrowseCursor | null {
  for (const decade of decades) {
    const year = decade.years.find((item) => item.year === yearValue)
    const month = year?.months[0]
    if (year && month) {
      return { decade: decade.decade, year: year.year, yearMonth: month.yearMonth }
    }
  }
  return null
}

const EMPTY_MONTH: never[] = []

export function monthItems<T extends YearMonthItem>(
  decades: DecadeGroup<T>[],
  cursor: BrowseCursor | null,
): T[] {
  if (!cursor) {
    return EMPTY_MONTH as T[]
  }
  const decade = decades.find((item) => item.decade === cursor.decade)
  const year = decade?.years.find((item) => item.year === cursor.year)
  const month = year?.months.find((item) => (item.yearMonth ?? null) === cursor.yearMonth)
  return month?.items ?? (EMPTY_MONTH as T[])
}

/** Keep the current month when it still has items; otherwise open the newest month. */
export function keepOrDefaultCursor<T extends YearMonthItem>(
  decades: DecadeGroup<T>[],
  current: BrowseCursor | null,
): BrowseCursor | null {
  if (current && monthItems(decades, current).length > 0) {
    return current
  }
  if (current) {
    const found = cursorForYearMonth(decades, current.yearMonth)
    if (found && monthItems(decades, found).length > 0) {
      return found
    }
  }
  return defaultBrowseCursor(decades)
}

/** Newest year, then newest month. Undated last. Order inside a month is unchanged. */
export function groupByYearMonth<T extends YearMonthItem>(items: T[]): YearGroup<T>[] {
  const byYear = new Map<string, Map<string, T[]>>()
  for (const item of items) {
    const year = yearLabel(item.yearMonth)
    const monthKey = item.yearMonth ?? 'undated'
    let months = byYear.get(year)
    if (!months) {
      months = new Map()
      byYear.set(year, months)
    }
    const bucket = months.get(monthKey)
    if (bucket) {
      bucket.push(item)
    } else {
      months.set(monthKey, [item])
    }
  }

  const years = [...byYear.keys()].sort((a, b) => {
    if (a === 'Undated') {
      return 1
    }
    if (b === 'Undated') {
      return -1
    }
    return b.localeCompare(a)
  })

  return years.map((year) => {
    const months = byYear.get(year)!
    const keys = [...months.keys()].sort((a, b) => {
      if (a === 'undated') {
        return 1
      }
      if (b === 'undated') {
        return -1
      }
      return b.localeCompare(a)
    })
    return {
      year,
      months: keys.map((key) => {
        const yearMonth = key === 'undated' ? null : key
        return {
          yearMonth,
          year,
          monthLabel: monthLabel(yearMonth),
          items: months.get(key)!,
        }
      }),
    }
  })
}

export function flattenYearMonthGroups<T extends YearMonthItem>(groups: YearGroup<T>[]): T[] {
  return groups.flatMap((group) => group.months.flatMap((month) => month.items))
}

export function adjacentInOrder<T extends { absolutePath: string }>(
  ordered: T[],
  currentPath: string,
  direction: 'prev' | 'next',
): T | null {
  const index = ordered.findIndex((item) => item.absolutePath === currentPath)
  if (index < 0) {
    return null
  }
  const nextIndex = direction === 'next' ? index + 1 : index - 1
  return ordered[nextIndex] ?? null
}
