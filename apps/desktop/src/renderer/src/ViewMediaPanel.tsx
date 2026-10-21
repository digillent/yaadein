import { useEffect, useMemo, useRef, useState } from 'react'
import type { CherishListResult, CherishMediaEntry, TagFilter } from '@shared/cherishTypes'
import { buildLocalMediaPreview } from '@shared/buildLocalMediaPreview'
import {
  collectTagFilters,
  matchesAllTagFilters,
  tagFilterKey,
} from '@shared/tagFilter'
import {
  adjacentInOrder,
  cursorForDecade,
  cursorForYear,
  cursorForYearMonth,
  defaultBrowseCursor,
  flattenYearMonthGroups,
  groupByDecade,
  groupByYearMonth,
  keepOrDefaultCursor,
  monthItems,
  shortMonthLabel,
  type BrowseCursor,
} from './cherishGroups'
import { LazyMediaThumb } from './LazyMediaThumb'
import { columnCountFromTemplate, gridNeighborIndex, thumbArrowFromKey } from './thumbGridNav'
import { FullscreenHost } from './FullscreenHost'
import { LocalVideoPlayer } from './LocalVideoPlayer'

type Props = {
  workingRoot: string
  busy: boolean
  signedIn: boolean
  onStatus: (message: string) => void
  onBusy: (run: () => Promise<void>) => Promise<void>
  onSignIn: () => Promise<void>
  onBackHome: () => void
  onRestoreFromCloud: () => Promise<void>
}

function formatTags(entry: CherishMediaEntry): string {
  const parts = [
    ...entry.tags.people.map((v) => `people:${v}`),
    ...entry.tags.places.map((v) => `places:${v}`),
    ...entry.tags.events.map((v) => `events:${v}`),
  ]
  return parts.length > 0 ? parts.join(' · ') : 'No tags'
}

function formatCopyNote(entry: CherishMediaEntry): string | null {
  if (entry.localCopyCount <= 1) {
    return null
  }
  return `${entry.localCopyCount} local copies (same SHA-256); extras: ${entry.extraLocalPaths.join(', ')}`
}

/** Browse preserve/ keepers with multi-select tag filters (AND); reject to rejected/. */
export function ViewMediaPanel({
  workingRoot,
  busy,
  signedIn,
  onStatus,
  onBusy,
  onSignIn,
  onBackHome,
  onRestoreFromCloud,
}: Props) {
  const [list, setList] = useState<CherishListResult | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set())
  const [focusPath, setFocusPath] = useState<string | null>(null)
  const [cursor, setCursor] = useState<BrowseCursor | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const keyboardNav = useRef(false)

  const availableFilters = useMemo(
    () => collectTagFilters(list?.files ?? []),
    [list],
  )

  const selectedFilters: TagFilter[] = useMemo(
    () => availableFilters.filter((f) => selectedKeys.has(tagFilterKey(f))),
    [availableFilters, selectedKeys],
  )

  const visibleFiles = useMemo(() => {
    const files = list?.files ?? []
    return files.filter((file) => matchesAllTagFilters(file.tags, selectedFilters))
  }, [list, selectedFilters])

  const allGroups = useMemo(() => groupByYearMonth(visibleFiles), [visibleFiles])
  const decades = useMemo(() => groupByDecade(allGroups), [allGroups])
  const orderedFiles = useMemo(() => flattenYearMonthGroups(allGroups), [allGroups])
  const activeDecade = decades.find((item) => item.decade === cursor?.decade) ?? null
  const activeYear = activeDecade?.years.find((item) => item.year === cursor?.year) ?? null
  const thumbFiles = monthItems(decades, cursor)

  useEffect(() => {
    setCursor((current) => keepOrDefaultCursor(decades, current))
  }, [decades])

  useEffect(() => {
    if (thumbFiles.some((file) => file.absolutePath === focusPath)) {
      return
    }
    setFocusPath(thumbFiles[0]?.absolutePath ?? null)
  }, [thumbFiles, focusPath])

  useEffect(() => {
    const card = document.querySelector('.cherishCardActive')
    if (!(card instanceof HTMLElement)) {
      return
    }
    card.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    if (!keyboardNav.current) {
      return
    }
    keyboardNav.current = false
    const opener = card.querySelector('.cherishCardOpen')
    if (opener instanceof HTMLElement) {
      opener.focus({ preventScroll: true })
    }
  }, [focusPath])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (document.fullscreenElement) {
        return
      }
      const direction = thumbArrowFromKey(event.key)
      if (!direction) {
        return
      }
      const target = event.target
      if (!(target instanceof Element) || !target.closest('.cherishBrowser')) {
        return
      }
      if (target.closest('input, textarea, select')) {
        return
      }
      const index = thumbFiles.findIndex((file) => file.absolutePath === focusPath)
      if (index < 0) {
        return
      }
      const columns = columnCountFromTemplate(
        gridRef.current ? getComputedStyle(gridRef.current).gridTemplateColumns : null,
      )
      const next = gridNeighborIndex(index, thumbFiles.length, columns, direction)
      event.preventDefault()
      if (next == null) {
        return
      }
      keyboardNav.current = true
      setFocusPath(thumbFiles[next]?.absolutePath ?? null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [thumbFiles, focusPath])

  const focusEntry = orderedFiles.find((f) => f.absolutePath === focusPath) ?? null
  const focusIndex = focusEntry
    ? orderedFiles.findIndex((f) => f.absolutePath === focusEntry.absolutePath)
    : -1
  const focusPreview = focusEntry ? buildLocalMediaPreview(focusEntry.absolutePath) : null

  function chooseCursor(next: BrowseCursor | null): void {
    setCursor(next ?? defaultBrowseCursor(decades))
  }

  function stepFocus(direction: 'prev' | 'next'): void {
    if (busy || !focusPath) {
      return
    }
    const next = adjacentInOrder(orderedFiles, focusPath, direction)
    if (!next) {
      return
    }
    setFocusPath(next.absolutePath)
    const nextCursor = cursorForYearMonth(decades, next.yearMonth)
    if (nextCursor) {
      setCursor(nextCursor)
    }
  }

  async function refreshList(): Promise<void> {
    await onBusy(async () => {
      try {
        const next = await window.yaadein.listCherishMedia({ workingRoot })
        setList(next)
        setSelectedKeys(new Set())
        setSelectedPaths(new Set())
        setFocusPath(null)
        setCursor(null)
        const tagged = next.files.filter((f) => f.hasCosmosAccepted).length
        const extras = next.files.reduce((sum, f) => sum + Math.max(0, f.localCopyCount - 1), 0)
        onStatus(
          next.tagsFromCosmos
            ? `View media: ${next.files.length} unique hash(es) in preserve/ (${tagged} with Cosms tags)${
                extras > 0 ? `; ${extras} extra local copy(ies) hidden` : ''
              }`
            : `View media: ${next.files.length} unique hash(es) in preserve/ (sign in for Cosms tags)${
                extras > 0 ? `; ${extras} extra local copy(ies) hidden` : ''
              }`,
        )
      } catch (error) {
        setList(null)
        onStatus(error instanceof Error ? error.message : String(error))
      }
    })
  }

  useEffect(() => {
    void refreshList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingRoot, signedIn])

  function toggleFilter(filter: TagFilter): void {
    const key = tagFilterKey(filter)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function toggleSelected(path: string): void {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  function filtersForDimension(dimension: TagFilter['dimension']): TagFilter[] {
    return availableFilters.filter((f) => f.dimension === dimension)
  }

  async function rejectPaths(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      onStatus('Select media to reject.')
      return
    }
    if (!signedIn) {
      onStatus('Sign in required to reject (updates Cosms).')
      return
    }
    await onBusy(async () => {
      let ok = 0
      const errors: string[] = []
      try {
        for (const sourcePath of paths) {
          try {
            await window.yaadein.rejectCherishMedia({ workingRoot, sourcePath })
            ok += 1
          } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error))
          }
        }
        if (errors.length === 0) {
          onStatus(`Rejected ${ok}: Blob deleted, Cosms REJECTED, moved to rejected/.`)
        } else {
          onStatus(
            `Rejected ${ok}; ${errors.length} failed. ${errors[0]}${
              errors.length > 1 ? ` (+${errors.length - 1} more)` : ''
            }`,
          )
        }
        const next = await window.yaadein.listCherishMedia({ workingRoot })
        setList(next)
        setSelectedPaths(new Set())
        if (focusPath && paths.includes(focusPath)) {
          setFocusPath(null)
        }
      } catch (error) {
        onStatus(error instanceof Error ? error.message : String(error))
      }
    })
  }

  return (
    <section className="cherishLibrary" aria-label="View media">
      <div className="row navRow">
        <button type="button" disabled={busy} onClick={onBackHome}>
          Home
        </button>
        <button type="button" disabled={busy} onClick={() => void refreshList()}>
          Refresh
        </button>
        <button
          type="button"
          disabled={busy || !signedIn}
          onClick={() => void onRestoreFromCloud()}
        >
          Restore from cloud
        </button>
        {!signedIn ? (
          <button type="button" disabled={busy} onClick={() => void onSignIn()}>
            Sign in
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || !signedIn || selectedPaths.size === 0}
          onClick={() => void rejectPaths([...selectedPaths])}
        >
          Reject selected ({selectedPaths.size})
        </button>
      </div>

      <p className="hint cherishHint">
        Pick a decade, year, and month. The preview stays put while thumbnails scroll on their own.
        In the thumbnail pane, arrow keys move to a neighbor when there is one. In full screen, ← and →
        move through the library. Tags use <strong>AND</strong>.
      </p>

      <div className="cherishFilters" aria-label="Tag filters">
        {(['people', 'places', 'events'] as const).map((dimension) => {
          const options = filtersForDimension(dimension)
          if (options.length === 0) {
            return null
          }
          return (
            <div key={dimension} className="cherishFilterGroup">
              <h3>{dimension}</h3>
              <div className="cherishFilterOptions">
                {options.map((filter) => {
                  const key = tagFilterKey(filter)
                  const checked = selectedKeys.has(key)
                  return (
                    <label key={key} className="cherishFilterOption">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggleFilter(filter)}
                      />
                      {filter.value}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
        {availableFilters.length === 0 ? (
          <p className="hint">
            {list?.tagsFromCosmos
              ? 'No tags on accepted media yet.'
              : 'Sign in to load Cosms tags for filtering.'}
          </p>
        ) : null}
        {selectedFilters.length > 0 ? (
          <button type="button" disabled={busy} onClick={() => setSelectedKeys(new Set())}>
            Clear tag filters
          </button>
        ) : null}
      </div>

      <div className="cherishWorkspace">
        <div className="cherishPreview" aria-label="Preview">
          {focusEntry ? (
            <>
              <div className="row">
                <button
                  type="button"
                  disabled={busy || focusIndex <= 0}
                  onClick={() => stepFocus('prev')}
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  disabled={busy || focusIndex < 0 || focusIndex >= orderedFiles.length - 1}
                  onClick={() => stepFocus('next')}
                >
                  Next →
                </button>
                <button
                  type="button"
                  disabled={busy || !signedIn}
                  onClick={() => void rejectPaths([focusEntry.absolutePath])}
                >
                  Reject this
                </button>
              </div>
              <FullscreenHost disabled={!focusPreview?.streamUrl} onArrow={stepFocus}>
                <div className="cherishFocusStage">
                  {focusPreview?.kind === 'video' && focusPreview.streamUrl ? (
                    <LocalVideoPlayer src={focusPreview.streamUrl} autoPlay layout="focus" />
                  ) : focusPreview?.kind === 'image' && focusPreview.streamUrl ? (
                    <img
                      src={focusPreview.streamUrl}
                      alt={focusEntry.originalFilename}
                      className="cherishFocusMedia"
                    />
                  ) : (
                    <p className="hint">No preview</p>
                  )}
                </div>
                <p className="cherishFullscreenMeta">
                  {focusIndex + 1} / {orderedFiles.length} · {focusEntry.originalFilename} · ←
                  previous · → next
                </p>
              </FullscreenHost>
              <p className="cherishName">{focusEntry.relativePath}</p>
              <p className="hint">{formatTags(focusEntry)}</p>
              {formatCopyNote(focusEntry) ? (
                <p className="hint cherishCopyNote">{formatCopyNote(focusEntry)}</p>
              ) : null}
            </>
          ) : (
            <p className="hint">
              {list && list.files.length > 0
                ? 'No keepers match the selected tags.'
                : `No previewable media under ${workingRoot}/preserve/.`}
            </p>
          )}
        </div>

        <div className="cherishBrowser">
          <div className="cherishBrowseBar">
            <div className="cherishBrowseRow" role="toolbar" aria-label="Decades">
              {decades.map((decade) => (
                <button
                  key={decade.decade}
                  type="button"
                  aria-pressed={decade.decade === cursor?.decade}
                  disabled={busy}
                  onClick={() => chooseCursor(cursorForDecade(decades, decade.decade))}
                >
                  {decade.decade}
                </button>
              ))}
            </div>
            {activeDecade ? (
              <div className="cherishBrowseRow" role="toolbar" aria-label="Years">
                {activeDecade.years.map((year) => (
                  <button
                    key={year.year}
                    type="button"
                    aria-pressed={year.year === cursor?.year}
                    disabled={busy}
                    onClick={() => chooseCursor(cursorForYear(decades, year.year))}
                  >
                    {year.year}
                  </button>
                ))}
              </div>
            ) : null}
            {activeYear ? (
              <div className="cherishBrowseRow" role="toolbar" aria-label="Months">
                {activeYear.months.map((month) => (
                  <button
                    key={month.yearMonth ?? 'undated'}
                    type="button"
                    aria-pressed={(month.yearMonth ?? null) === (cursor?.yearMonth ?? null)}
                    disabled={busy}
                    onClick={() =>
                      chooseCursor({
                        decade: activeDecade?.decade ?? cursor?.decade ?? '',
                        year: activeYear.year,
                        yearMonth: month.yearMonth,
                      })
                    }
                  >
                    {shortMonthLabel(month.yearMonth)}
                    <span className="cherishJumpCount"> {month.items.length}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <p className="status" role="status">
              {thumbFiles.length} in this month
              {list ? ` · ${visibleFiles.length} shown` : ''}
              {selectedFilters.length > 0
                ? ` · AND ${selectedFilters.map(tagFilterKey).join(', ')}`
                : ''}
            </p>
          </div>
          <div className="cherishThumbs">
            {thumbFiles.length > 0 ? (
              <div className="cherishGrid" ref={gridRef}>
                {thumbFiles.map((file) => {
                  const checked = selectedPaths.has(file.absolutePath)
                  const active = file.absolutePath === focusPath
                  return (
                    <div
                      key={file.absolutePath}
                      className={`cherishCard${active ? ' cherishCardActive' : ''}`}
                    >
                      <label className="cherishSelect">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy}
                          onChange={() => toggleSelected(file.absolutePath)}
                        />
                        Select
                      </label>
                      <button
                        type="button"
                        className="cherishCardOpen"
                        disabled={busy}
                        onClick={() => setFocusPath(file.absolutePath)}
                      >
                        <LazyMediaThumb
                          absolutePath={file.absolutePath}
                          alt={file.originalFilename}
                          className="cherishThumb"
                        />
                        <p className="cherishName">{file.originalFilename}</p>
                        <p className="hint cherishTagLine">{formatTags(file)}</p>
                        {file.localCopyCount > 1 ? (
                          <p className="hint cherishCopyNote">{file.localCopyCount}× same hash</p>
                        ) : null}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="hint">
                {list && list.files.length > 0
                  ? 'No keepers match the selected tags.'
                  : `No previewable media under ${workingRoot}/preserve/. Accept media in review or run restore.`}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
